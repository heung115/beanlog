package main

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"
)

// The optional transport stays private and requires explicit mTLS credentials.
// JWT verification still authorizes each RPC after client certificate admission.
func secureTransport(getenv func(string) string) (string, []grpc.ServerOption, error) {
	address := getenv("GRPC_LISTEN_ADDR")
	if address == "" {
		address = "127.0.0.1:9090"
	}
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return "", nil, errors.New("GRPC_LISTEN_ADDR must be a private IP address and port")
	}
	ip := net.ParseIP(host)
	if ip == nil || !(ip.IsLoopback() || ip.IsPrivate() || inTailscaleRange(ip)) {
		return "", nil, errors.New("gRPC requires an explicit private or loopback listen address")
	}
	certFile, keyFile, caFile := getenv("GRPC_TLS_CERT_FILE"), getenv("GRPC_TLS_KEY_FILE"), getenv("GRPC_CLIENT_CA_FILE")
	if certFile == "" || keyFile == "" || caFile == "" {
		return "", nil, errors.New("gRPC requires server TLS certificate/key and a client CA file")
	}
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return "", nil, errors.New("cannot load gRPC server certificate/key")
	}
	caPEM, err := os.ReadFile(caFile)
	if err != nil {
		return "", nil, errors.New("cannot load gRPC client CA")
	}
	clientCAs := x509.NewCertPool()
	if !clientCAs.AppendCertsFromPEM(caPEM) {
		return "", nil, errors.New("invalid gRPC client CA")
	}
	return address, []grpc.ServerOption{
		grpc.Creds(credentials.NewTLS(&tls.Config{
			MinVersion:   tls.VersionTLS13,
			Certificates: []tls.Certificate{cert},
			ClientCAs:    clientCAs,
			ClientAuth:   tls.RequireAndVerifyClientCert,
		})),
		grpc.MaxRecvMsgSize(1 << 20),
		grpc.MaxSendMsgSize(4 << 20),
		grpc.MaxConcurrentStreams(16),
		grpc.ConnectionTimeout(5 * time.Second),
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle:     2 * time.Minute,
			MaxConnectionAge:      30 * time.Minute,
			MaxConnectionAgeGrace: 10 * time.Second,
			Time:                  2 * time.Minute, Timeout: 10 * time.Second,
		}),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{MinTime: time.Minute}),
	}, nil
}

func inTailscaleRange(ip net.IP) bool {
	_, tailnet, _ := net.ParseCIDR("100.64.0.0/10")
	return tailnet.Contains(ip)
}
