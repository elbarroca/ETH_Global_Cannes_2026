package verifier

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
)

const (
	SchemaVersion   = 1
	MaxRequestBytes = 256 * 1024
	MaxReceiptBytes = 128 * 1024
	MaxPayloadBytes = 1024 * 1024
)

var (
	hexDigestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	rootPattern      = regexp.MustCompile(`^0x[0-9a-f]{64}$`)
)

type Request struct {
	SchemaVersion  int    `json:"schemaVersion"`
	EffectID       string `json:"effectId"`
	ExpectedDigest string `json:"expectedDigest"`
	ExpectedSize   int    `json:"expectedSize"`
	IndexerURL     string `json:"indexerUrl"`
	ReceiptBytes   string `json:"receiptBytes"`
	ReceiptDigest  string `json:"receiptDigest"`
	Root           string `json:"root"`
}

// Field order is alphabetical so encoding/json produces the canonical receipt
// bytes emitted by the TypeScript boundary.
type Receipt struct {
	Digest        string `json:"digest"`
	EffectID      string `json:"effectId"`
	Root          string `json:"root"`
	SchemaVersion int    `json:"schemaVersion"`
	Size          int    `json:"size"`
}

type Response struct {
	Digest        string `json:"digest"`
	EffectID      string `json:"effectId"`
	Root          string `json:"root"`
	SchemaVersion int    `json:"schemaVersion"`
	Size          int    `json:"size"`
	Verified      bool   `json:"verified"`
}

type Downloader interface {
	Download(ctx context.Context, root, filename string, withProof bool) error
}

type Factory func(indexerURL string) (Downloader, func(), error)

func decodeOneStrict[T any](raw []byte) (T, error) {
	var value T
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return value, err
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return value, errors.New("trailing JSON value")
		}
		return value, err
	}
	return value, nil
}

func sha256Hex(raw []byte) string {
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func validateRequest(request Request) error {
	if request.SchemaVersion != SchemaVersion {
		return errors.New("unsupported request schema")
	}
	if !hexDigestPattern.MatchString(request.EffectID) {
		return errors.New("invalid effect id")
	}
	if !rootPattern.MatchString(request.Root) {
		return errors.New("invalid lowercase root")
	}
	if !hexDigestPattern.MatchString(request.ExpectedDigest) || !hexDigestPattern.MatchString(request.ReceiptDigest) {
		return errors.New("invalid lowercase digest")
	}
	if request.ExpectedSize < 1 || request.ExpectedSize > MaxPayloadBytes {
		return errors.New("invalid expected size")
	}
	if len(request.ReceiptBytes) < 1 || len(request.ReceiptBytes) > MaxReceiptBytes {
		return errors.New("invalid receipt size")
	}
	parsedURL, err := url.Parse(request.IndexerURL)
	if err != nil || parsedURL.Scheme != "https" || parsedURL.Host == "" || parsedURL.User != nil {
		return errors.New("indexer URL must be an HTTPS authority without credentials")
	}
	return nil
}

func validateReceipt(request Request) error {
	raw := []byte(request.ReceiptBytes)
	if sha256Hex(raw) != request.ReceiptDigest {
		return errors.New("receipt digest mismatch")
	}
	receipt, err := decodeOneStrict[Receipt](raw)
	if err != nil {
		return fmt.Errorf("invalid receipt schema: %w", err)
	}
	canonical, err := json.Marshal(receipt)
	if err != nil {
		return fmt.Errorf("encode canonical receipt: %w", err)
	}
	if !bytes.Equal(raw, canonical) {
		return errors.New("receipt bytes are not canonical JSON")
	}
	if receipt.SchemaVersion != SchemaVersion || receipt.EffectID != request.EffectID ||
		receipt.Root != request.Root || receipt.Digest != request.ExpectedDigest ||
		receipt.Size != request.ExpectedSize {
		return errors.New("receipt binding mismatch")
	}
	return nil
}

func Verify(ctx context.Context, input io.Reader, factory Factory) (Response, error) {
	limited, err := io.ReadAll(io.LimitReader(input, MaxRequestBytes+1))
	if err != nil {
		return Response{}, fmt.Errorf("read request: %w", err)
	}
	if len(limited) > MaxRequestBytes {
		return Response{}, errors.New("request exceeds maximum size")
	}
	request, err := decodeOneStrict[Request](limited)
	if err != nil {
		return Response{}, fmt.Errorf("invalid request schema: %w", err)
	}
	if err := validateRequest(request); err != nil {
		return Response{}, err
	}
	if err := validateReceipt(request); err != nil {
		return Response{}, err
	}

	tempDirectory, err := os.MkdirTemp("", "alphadawg-0g-proof-")
	if err != nil {
		return Response{}, fmt.Errorf("create temporary directory: %w", err)
	}
	defer os.RemoveAll(tempDirectory)
	downloadPath := filepath.Join(tempDirectory, "readback.bin")

	downloader, closeDownloader, err := factory(request.IndexerURL)
	if err != nil {
		return Response{}, fmt.Errorf("create non-trusted downloader: %w", err)
	}
	defer closeDownloader()
	if err := downloader.Download(ctx, request.Root, downloadPath, true); err != nil {
		return Response{}, fmt.Errorf("proof download failed: %w", err)
	}
	info, err := os.Stat(downloadPath)
	if err != nil {
		return Response{}, fmt.Errorf("stat proof download: %w", err)
	}
	if info.Size() < 1 || info.Size() > MaxPayloadBytes || info.Size() != int64(request.ExpectedSize) {
		return Response{}, errors.New("downloaded size mismatch")
	}
	payload, err := os.ReadFile(downloadPath)
	if err != nil {
		return Response{}, fmt.Errorf("read proof download: %w", err)
	}
	observedDigest := sha256Hex(payload)
	if observedDigest != request.ExpectedDigest {
		return Response{}, errors.New("downloaded digest mismatch")
	}

	return Response{
		Digest:        observedDigest,
		EffectID:      request.EffectID,
		Root:          request.Root,
		SchemaVersion: SchemaVersion,
		Size:          len(payload),
		Verified:      true,
	}, nil
}
