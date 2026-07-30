FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o beanlog-server .

FROM alpine:3.20
RUN apk --no-cache add ca-certificates && \
    addgroup -S -g 1001 appgroup && \
    adduser -S -u 1001 -G appgroup appuser
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/beanlog-server .
USER appuser
EXPOSE 8080
CMD ["./beanlog-server"]
