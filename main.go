package main

import (
    "embed"
    "errors"
    "fmt"
    "io/fs"
    "log"
    "net"
    "net/http"
    "os"
    "os/exec"
    "os/signal"
    "runtime"
    "strings"
    "syscall"
    "time"
)

const productTitle = "Pixel Hero Maker [v.89]"

// The complete verified Web package is embedded at build time; no external
// assets, Python installation, or Internet connection are required.
//go:embed game
var contents embed.FS

func main() {
    setWindowTitle(productTitle)
    files, err := fs.Sub(contents, "game")
    if err != nil { log.Fatal("Embedded game missing: ", err) }
    listener, err := net.Listen("tcp4", "127.0.0.1:0")
    if err != nil { log.Fatal("Cannot start local game server: ", err) }
    defer listener.Close()
    addr := listener.Addr().String()
    url := "http://" + addr + "/"
    fileServer := http.FileServer(http.FS(files))
    handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Never serve on an externally addressed Host, even from a local bind.
        if !strings.EqualFold(r.Host, addr) {
            http.Error(w, "This offline game is available only at its local launcher address.", http.StatusForbidden)
            return
        }
        w.Header().Set("Cache-Control", "no-store")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        switch {
        case strings.HasSuffix(r.URL.Path, ".wasm"):
            w.Header().Set("Content-Type", "application/wasm")
        case strings.HasSuffix(r.URL.Path, ".data"):
            w.Header().Set("Content-Type", "application/octet-stream")
        case strings.HasSuffix(r.URL.Path, ".js"):
            w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
        case strings.HasSuffix(r.URL.Path, ".json"):
            w.Header().Set("Content-Type", "application/json; charset=utf-8")
        }
        fileServer.ServeHTTP(w, r)
    })
    server := &http.Server{Handler: handler, ReadHeaderTimeout: 10 * time.Second}
    go func() {
        err := server.Serve(listener)
        if err != nil && !errors.Is(err, http.ErrServerClosed) {
            log.Println("Local game server stopped: ", err)
        }
    }()
    fmt.Printf("%s\n\nOffline game ready at:\n%s\n\nKeep this window open while playing.\nClose this window to stop the server.\n", productTitle, url)
    if os.Getenv("PHM_DISABLE_BROWSER") != "1" {
        if err := openBrowser(url); err != nil {
            fmt.Fprintf(os.Stderr, "Could not open the browser automatically: %v\nOpen %s manually.\n", err, url)
        }
    }
    // Stay alive for browser access. A console close or Ctrl+C ends the server.
    signals := make(chan os.Signal, 1)
    signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
    <-signals
    _ = server.Close()
}

func openBrowser(url string) error {
    var command *exec.Cmd
    switch runtime.GOOS {
    case "windows":
        command = exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", url)
    case "darwin":
        command = exec.Command("open", url)
    default:
        command = exec.Command("xdg-open", url)
    }
    return command.Start()
}
