package grpcserver

import (
	"context"
	"strings"

	"beanmap-server/middleware"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

type userIDKey struct{}

// UserIDFromContext returns the authenticated user id placed on the context by
// the auth interceptor. Handlers use this instead of reading metadata directly.
func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDKey{}).(string)
	return id, ok
}

// authorizationFromMetadata extracts the raw JWT from gRPC metadata. gRPC
// metadata keys are lowercase; clients send "authorization: Bearer <jwt>".
func authorizationFromMetadata(ctx context.Context) (string, bool) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", false
	}
	values := md.Get("authorization")
	if len(values) == 0 {
		return "", false
	}
	header := values[0]
	token, found := strings.CutPrefix(header, "Bearer ")
	if !found {
		return "", false
	}
	return token, true
}

// AuthUnaryInterceptor returns a unary server interceptor that validates the
// caller's Supabase JWT using the shared TokenVerifier and injects the user id
// into the context. It mirrors the REST AuthRequired middleware so both
// transports enforce identical signature, issuer, audience, and role rules.
func AuthUnaryInterceptor(verifier *middleware.TokenVerifier) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		token, ok := authorizationFromMetadata(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing or malformed authorization metadata")
		}

		userID, err := verifier.Verify(token)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid token")
		}

		return handler(context.WithValue(ctx, userIDKey{}, userID), req)
	}
}
