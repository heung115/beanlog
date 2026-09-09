# Exact server-local immutable base image; no mutable registry tag resolution.
FROM sha256:9cdfdf899e1c1be1a78a5ca5912568ea143344e3d503f4ca0b3aec39e8bc776e
LABEL org.beanmap.patch.base-image-id="sha256:9cdfdf899e1c1be1a78a5ca5912568ea143344e3d503f4ca0b3aec39e8bc776e" \
      org.beanmap.patch.purpose="Remove PostgREST build headers and compiler tools; preserve runtime"
USER 0:0
RUN set -eu; \
    apt-mark manual libpq5 libnuma1 libgmp10 zlib1g libssl3t64 openssl-provider-legacy libc6 libgcc-s1 libstdc++6; \
    apt-get --simulate --purge autoremove gcc cpp binutils libc6-dev libc-dev-bin linux-libc-dev libgcc-15-dev libnuma-dev libpq-dev libssl-dev zlib1g-dev rpcsvc-proto; \
    DEBIAN_FRONTEND=noninteractive apt-get -y --purge autoremove gcc cpp binutils libc6-dev libc-dev-bin linux-libc-dev libgcc-15-dev libnuma-dev libpq-dev libssl-dev zlib1g-dev rpcsvc-proto; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    printf '%s  /usr/bin/postgrest\n' '35a22aeb526f4b900268984614d67d0d243f0c9abaa9d67f41ffcd213f488c27' | sha256sum -c -; \
    ! command -v gcc; \
    ! command -v cpp; \
    ! command -v ld; \
    test ! -d /usr/include/linux
USER 1000:1000
CMD ["postgrest"]
