package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/test/bufconn"
)

func TestTransportRejectsPublicBindingAndMissingCredentials(t *testing.T) {
	for _, address := range []string{"", ":9090", "0.0.0.0:9090", "[::]:9090", "8.8.8.8:9090", "localhost:9090", "127.0.0.1:9090"} {
		t.Run(address, func(t *testing.T) {
			_, _, err := secureTransport(func(key string) string {
				if key == "GRPC_LISTEN_ADDR" {
					return address
				}
				return ""
			})
			if err == nil {
				t.Fatal("unsafe or credential-free transport accepted")
			}
		})
	}
}

func TestTransportRequiresTrustedClientCertificate(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "gRPC test CA"},
		NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour),
		IsCA: true, BasicConstraintsValid: true,
		KeyUsage:    x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	certPath, keyPath := filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem")
	if err := os.WriteFile(certPath, certPEM, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, keyPEM, 0o600); err != nil {
		t.Fatal(err)
	}
	address, options, err := secureTransport(func(name string) string {
		switch name {
		case "GRPC_TLS_CERT_FILE", "GRPC_CLIENT_CA_FILE":
			return certPath
		case "GRPC_TLS_KEY_FILE":
			return keyPath
		default:
			return ""
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if address != "127.0.0.1:9090" {
		t.Fatalf("unexpected listen default: %s", address)
	}
	listener := bufconn.Listen(1 << 20)
	server := grpc.NewServer(options...)
	healthpb.RegisterHealthServer(server, health.NewServer())
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	ca := x509.NewCertPool()
	ca.AppendCertsFromPEM(certPEM)
	certificate, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		t.Fatal(err)
	}
	for _, withCert := range []bool{true, false} {
		clientTLS := &tls.Config{MinVersion: tls.VersionTLS13, RootCAs: ca, ServerName: "127.0.0.1"}
		if withCert {
			clientTLS.Certificates = []tls.Certificate{certificate}
		}
		connection, err := grpc.NewClient("passthrough:///buffer", grpc.WithTransportCredentials(credentials.NewTLS(clientTLS)),
			grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return listener.DialContext(ctx) }))
		if err != nil {
			t.Fatal(err)
		}
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		_, err = healthpb.NewHealthClient(connection).Check(ctx, &healthpb.HealthCheckRequest{})
		cancel()
		_ = connection.Close()
		if withCert && err != nil {
			t.Fatalf("trusted client failed: %v", err)
		}
		if !withCert && err == nil {
			t.Fatal("client without certificate admitted")
		}
	}
}
