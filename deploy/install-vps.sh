#!/usr/bin/env bash
# Office Lab («المعمل») — one-time setup of the server version on a fresh Ubuntu 24.04 VPS.
#   curl -fsSL https://raw.githubusercontent.com/micro4tricks-ai/office-lab/main/deploy/install-vps.sh | sudo bash
# Safe to run again: it updates the code and restarts the containers.
set -euo pipefail

REPO="https://github.com/micro4tricks-ai/office-lab.git"
DIR="/opt/office-lab"

if [ "$(id -u)" -ne 0 ]; then
	echo "Run as root: sudo bash install-vps.sh" >&2
	exit 1
fi
if [ "$(dpkg --print-architecture)" != "amd64" ]; then
	echo "This setup expects an x86-64 (amd64) server." >&2
	exit 1
fi

echo "==> Packages"
apt-get update -q
apt-get install -y -q ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
	echo "==> Docker (official repository)"
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
	chmod a+r /etc/apt/keyrings/docker.asc
	codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
	echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
		>/etc/apt/sources.list.d/docker.list
	apt-get update -q
	apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# Another app (e.g. Hostinger's n8n template) already serving 443 through Traefik? Then we sit behind it.
proxy="$(docker ps --filter publish=443 --format '{{.Names}}' | head -n1)"
traefik=""
if [ -n "$proxy" ]; then
	if docker inspect "$proxy" --format '{{.Config.Image}}' | grep -qi traefik; then
		traefik="$proxy"
		echo "==> Found Traefik ($traefik) on 443: Office Lab will run behind it"
	else
		echo "Port 443 is used by '$proxy' (not Traefik). See deploy/HOSTINGER.md §9." >&2
		exit 1
	fi
fi

echo "==> Firewall: SSH, HTTP, HTTPS only"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

echo "==> Code in $DIR"
if [ -d "$DIR/.git" ]; then
	git -C "$DIR" pull --ff-only
else
	git clone --depth 1 "$REPO" "$DIR"
fi

ENV="$DIR/deploy/.env"
if [ ! -f "$ENV" ]; then
	cp "$DIR/deploy/.env.example" "$ENV"
	# Piped through bash: read the answer from the terminal, not from the script.
	read -r -p "Domain for the site (e.g. lab.example.com; empty = plain HTTP on this IP): " domain </dev/tty || domain=""
	domain="$(echo "$domain" | tr -d '[:space:]')"
	if [ -n "$domain" ]; then
		if ! echo "$domain" | grep -Eq '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
			echo "That doesn't look like a domain name: $domain" >&2
			exit 1
		fi
		sed -i "s|^DOMAIN=.*|DOMAIN=$domain|" "$ENV"
		sed -i "s|^SITE_ORIGIN=.*|SITE_ORIGIN=https://$domain|" "$ENV"
	fi
	if [ -n "$traefik" ]; then
		if [ -z "$domain" ]; then
			echo "Behind Traefik a domain is required (e.g. lab.example.com)." >&2
			rm -f "$ENV"
			exit 1
		fi
		args="$(docker inspect "$traefik" --format '{{join .Config.Cmd " "}} {{join .Args " "}}')"
		net="$(docker inspect "$traefik" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')"
		resolver="$(echo "$args" | grep -oE 'certificatesresolvers\.[A-Za-z0-9_-]+' | head -n1 | cut -d. -f2)"
		entry="$(echo "$args" | grep -oE 'entrypoints\.[A-Za-z0-9_-]+\.address=:443' | head -n1 | cut -d. -f2)"
		sed -i "s|^DOMAIN=.*|DOMAIN=:80|" "$ENV"
		sed -i "s|^CONCURRENCY=.*|CONCURRENCY=2|" "$ENV"
		{
			echo
			echo "# Behind the existing Traefik ($traefik) — written by install-vps.sh"
			echo "COMPOSE_FILE=docker-compose.yml:docker-compose.traefik.yml"
			echo "LAB_HOST=$domain"
			echo "TRAEFIK_NETWORK=$net"
			echo "TRAEFIK_CERTRESOLVER=${resolver:-mytlschallenge}"
			echo "TRAEFIK_ENTRYPOINT=${entry:-websecure}"
		} >>"$ENV"
		echo "    network=$net resolver=${resolver:-?} entrypoint=${entry:-?} (check in $ENV)"
	fi
	chmod 600 "$ENV"
fi

echo "==> Build and start (first time: 10-20 minutes)"
cd "$DIR/deploy"
docker compose up -d --build
docker image prune -f >/dev/null

domain="$(grep -E '^DOMAIN=' "$ENV" | cut -d= -f2)"
host="$(grep -E '^LAB_HOST=' "$ENV" | cut -d= -f2 || true)"
echo
if [ -n "$host" ]; then
	echo "Done: https://$host/  (through Traefik; DNS must point here)"
elif [ "$domain" = ":80" ] || [ -z "$domain" ]; then
	echo "Done: http://$(hostname -I | awk '{print $1}')/"
else
	echo "Done: https://$domain/  (the certificate is issued on the first visit; DNS must point here)"
fi
