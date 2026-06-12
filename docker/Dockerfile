FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    libmicrohttpd-dev \
    libjansson-dev \
    libssl-dev \
    libsrtp2-dev \
    libsofia-sip-ua-dev \
    libglib2.0-dev \
    libopus-dev \
    libogg-dev \
    libcurl4-openssl-dev \
    liblua5.3-dev \
    libconfig-dev \
    pkg-config \
    gengetopt \
    libtool \
    automake \
    cmake \
    wget \
    curl \
    ca-certificates \
    libnice-dev \
    zlib1g-dev \
    libwebsockets-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt

RUN git clone https://github.com/meetecho/janus-gateway.git

WORKDIR /opt/janus-gateway

RUN sh autogen.sh && \
    ./configure --prefix=/opt/janus --enable-post-processing && \
    make -j$(nproc) && \
    make install && \
    make configs

COPY ./janus-config/ /opt/janus/etc/janus/
COPY ./start-janus.sh /opt/start-janus.sh
RUN chmod +x /opt/start-janus.sh

# Create wrapper script so host can call janus-pp-rec via: docker exec
RUN ln -s /opt/janus/bin/janus-pp-rec /usr/local/bin/janus-pp-rec

CMD ["/opt/start-janus.sh"]
