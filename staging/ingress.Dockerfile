FROM caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d
# Port 8080 needs no capability; the upstream file capability would prevent
# execution under cap_drop: ALL even though the binary runs as an ordinary user.
RUN setcap -r /usr/bin/caddy
COPY --chmod=0444 Caddyfile /etc/caddy/Caddyfile
COPY --chmod=0555 ingress-entrypoint.sh /usr/local/bin/beanmap-staging-ingress
ENV HOME=/tmp XDG_CONFIG_HOME=/tmp/caddy/config XDG_DATA_HOME=/tmp/caddy/data
USER 1001:1001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/beanmap-staging-ingress"]
