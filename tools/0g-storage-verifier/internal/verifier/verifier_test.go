package verifier

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"testing"
)

type testDownloader struct {
	payload   []byte
	withProof bool
}

func (downloader *testDownloader) Download(_ context.Context, _ string, filename string, withProof bool) error {
	downloader.withProof = withProof
	return os.WriteFile(filename, downloader.payload, 0o600)
}

func digest(raw []byte) string {
	value := sha256.Sum256(raw)
	return hex.EncodeToString(value[:])
}

func validInput(t *testing.T, payload []byte) []byte {
	t.Helper()
	effectID := digest([]byte("effect"))
	root := "0x" + digest(payload)
	receipt, err := json.Marshal(Receipt{
		Digest: digest(payload), EffectID: effectID, Root: root, SchemaVersion: 1, Size: len(payload),
	})
	if err != nil {
		t.Fatal(err)
	}
	request := Request{
		SchemaVersion: 1, EffectID: effectID, ExpectedDigest: digest(payload),
		ExpectedSize: len(payload), IndexerURL: "https://fixture.invalid",
		ReceiptBytes: string(receipt), ReceiptDigest: digest(receipt), Root: root,
	}
	raw, err := json.Marshal(request)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestVerifyRequiresProofAndExactBytes(t *testing.T) {
	payload := []byte("signed fixture content")
	downloader := &testDownloader{payload: payload}
	response, err := Verify(context.Background(), bytes.NewReader(validInput(t, payload)), func(string) (Downloader, func(), error) {
		return downloader, func() {}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if !downloader.withProof || !response.Verified || response.Digest != digest(payload) || response.Size != len(payload) {
		t.Fatal("proof verification did not preserve exact fixture binding")
	}
}

func TestVerifyRejectsTamperAndStrictJSON(t *testing.T) {
	payload := []byte("signed fixture content")
	cases := [][]byte{
		append(validInput(t, payload), []byte(` {}`)...),
		bytes.Replace(validInput(t, payload), []byte(`"schemaVersion":1`), []byte(`"schemaVersion":1,"unknown":true`), 1),
	}
	for _, input := range cases {
		_, err := Verify(context.Background(), bytes.NewReader(input), func(string) (Downloader, func(), error) {
			return &testDownloader{payload: payload}, func() {}, nil
		})
		if err == nil {
			t.Fatal("strict JSON mutation was accepted")
		}
	}

	_, err := Verify(context.Background(), bytes.NewReader(validInput(t, payload)), func(string) (Downloader, func(), error) {
		return &testDownloader{payload: []byte("signed fixture contenU")}, func() {}, nil
	})
	if err == nil {
		t.Fatal("one-byte downloaded-content mutation was accepted")
	}
}

func TestApplyFileSizeLimitRejectsOversizeRegularFile(t *testing.T) {
	if os.Getenv("ALPHADAWG_RLIMIT_CHILD") == "1" {
		signal.Ignore(syscall.SIGXFSZ)
		if err := ApplyFileSizeLimit(); err != nil {
			os.Exit(2)
		}
		path := filepath.Join(os.Getenv("ALPHADAWG_RLIMIT_TEMP"), "oversize.bin")
		if err := os.WriteFile(path, make([]byte, MaxPayloadBytes+1), 0o600); err == nil {
			os.Exit(3)
		}
		info, err := os.Stat(path)
		if err != nil || info.Size() > MaxPayloadBytes {
			os.Exit(4)
		}
		os.Exit(0)
	}

	temporary := t.TempDir()
	command := exec.Command(os.Args[0], "-test.run=^TestApplyFileSizeLimitRejectsOversizeRegularFile$")
	command.Env = append(os.Environ(),
		"ALPHADAWG_RLIMIT_CHILD=1",
		"ALPHADAWG_RLIMIT_TEMP="+temporary,
	)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("file-size limit child failed: %v: %s", err, output)
	}
}
