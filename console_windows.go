//go:build windows
package main

import (
    "syscall"
    "unsafe"
)

func setWindowTitle(title string) {
    kernel32 := syscall.NewLazyDLL("kernel32.dll")
    proc := kernel32.NewProc("SetConsoleTitleW")
    ptr, err := syscall.UTF16PtrFromString(title)
    if err == nil { _, _, _ = proc.Call(uintptr(unsafe.Pointer(ptr))) }
}
