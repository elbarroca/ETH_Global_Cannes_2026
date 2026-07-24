package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"alphadawg.local/0g-storage-verifier/internal/verifier"
)

type fixtureDownloader struct {
	payload []byte
}

func (downloader fixtureDownloader) Download(
	ctx context.Context,
	root string,
	filename string,
	withProof bool,
) error {
	if !withProof {
		return errors.New("fixture downloader requires withProof=true")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	digest := sha256.Sum256(downloader.payload)
	if root != "0x"+hex.EncodeToString(digest[:]) {
		return errors.New("fixture root does not bind downloaded bytes")
	}
	return os.WriteFile(filename, downloader.payload, 0o600)
}

func main() {
	encoded := os.Getenv("ALPHADAWG_A3_FIXTURE_CONTENT_BASE64")
	payload, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(payload) == 0 {
		fmt.Fprintln(os.Stderr, "fixture content is missing or malformed")
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	response, err := verifier.Verify(ctx, os.Stdin, func(string) (verifier.Downloader, func(), error) {
		return fixtureDownloader{payload: payload}, func() {}, nil
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(response); err != nil {
		fmt.Fprintln(os.Stderr, "encode fixture response")
		os.Exit(1)
	}
}
