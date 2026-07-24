package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"alphadawg.local/0g-storage-verifier/internal/verifier"
	"github.com/0gfoundation/0g-storage-client/indexer"
)

func main() {
	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
		syscall.SIGXFSZ,
	)
	defer stop()
	if err := verifier.ApplyFileSizeLimit(); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}

	response, err := verifier.Verify(ctx, os.Stdin, func(indexerURL string) (verifier.Downloader, func(), error) {
		client, createErr := indexer.NewClient(indexerURL, indexer.IndexerClientOption{FullTrusted: false})
		if createErr != nil {
			return nil, func() {}, createErr
		}
		return client, client.Close, nil
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(response); err != nil {
		fmt.Fprintln(os.Stderr, "encode verifier response")
		os.Exit(1)
	}
}
