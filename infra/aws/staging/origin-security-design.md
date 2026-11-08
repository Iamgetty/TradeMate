# Staging origin security decision

## Current state

The current `foundation.yaml` and `services.yaml` define an internet-facing Application Load Balancer (ALB), with ports 80/443 open to IPv4 internet ingress. API and exchange-feed tasks remain private and accept traffic only from the ALB security group. HTTPS redirects to the ALB TLS listener; the listener routes only the two configured hostnames.

This is **not yet an origin-locked Cloudflare design**. A hostname being proxied by Cloudflare does not prevent a caller from reaching the ALB directly by its AWS DNS name or by resolving the origin address. The listener's host-header rules are routing, not authentication. The current default 404 response is not an origin security control.

Do not describe the current template as Cloudflare-only ingress or deploy it with production data.

## Important distinction: Cloudflare proxy IPs vs Workers egress

A static Cloudflare edge-IP allowlist is appropriate when Cloudflare's reverse proxy is the network peer connecting to the origin. It is not a safe assumption for arbitrary Cloudflare Workers subrequests: Workers egress does not generally provide a dedicated, stable per-application source-IP range that can be used as an origin allowlist. Do not copy Cloudflare's published proxy IP ranges into the ALB security group and assume that this secures Worker-to-origin requests.

## Implemented template target: private ALB behind Cloudflare Tunnel

For staging, prefer a Cloudflare Tunnel connector running as a dedicated, independently deployed ECS Fargate service:

1. Change the ALB to **internal** and place it in private application subnets; remove public HTTP/HTTPS ingress from the ALB security group.
2. Give the connector its own security group. Permit ALB listener ingress only from that connector security group.
3. Run at least one connector task in each application AZ for resilience. The connector initiates outbound connections to Cloudflare; it needs no inbound public listener. Its private subnet egress uses the approved NAT design.
4. Store the tunnel token in Secrets Manager. Give only the connector's ECS execution role permission to read that one secret. Never put the token in the image, task definition plaintext, GitHub, or chat.
5. Configure Cloudflare Tunnel hostnames to route the API hostname to the internal ALB API listener and the feed hostname to the internal ALB feed listener. Validate WebSocket upgrades, long-lived connections, reconnects, and graceful draining end-to-end before use.
6. Keep the ALB TLS listener and ACM certificate if the tunnel-to-origin leg uses HTTPS; validate certificate hostname/SNI and trust behavior. Alternatively use an explicitly reviewed private-origin TLS arrangement. Do not silently downgrade the origin leg to plaintext.
7. Add health checks, log retention, deployment rollback, connector capacity and tunnel-token rotation procedures.

This pattern avoids treating Workers egress IPs as fixed and removes the ALB from direct public reachability. The current branch templates now include the internal ALB, connector security group, private Fargate connector service and dedicated token-read role. The Cloudflare dashboard routes and runtime validation remain manual prerequisites.

## Alternatives and constraints

- **Cloudflare proxy IP allowlisting:** only use when the request path is confirmed to originate from Cloudflare's reverse-proxy network, not assumed for Worker subrequests. Keep the official IPv4 and IPv6 ranges current and automate updates.
- **Application-layer origin authentication:** a Cloudflare Worker can add a high-entropy shared secret header, and the API can validate it using a secret injected from Secrets Manager. This requires code changes, secret rotation, constant-time comparison, redaction from logs, and negative tests. It is not sufficient unless every route and alternate entry point enforces it. The exchange-feed WebSocket handshake requires separate validation. This is a fallback, not a reason to leave a publicly reachable unauthenticated origin.
- **AWS WAF:** useful for rate limiting and request filtering, but a WAF rule by itself does not prove that a request came from the user's Cloudflare Worker unless the origin-authentication design is sound.
- **CloudFront:** not a default replacement for Cloudflare's frontend role and not required for this API/feed origin path.

## Decision gate before staging deployment

Do not deploy until the Cloudflare Tunnel token secret, immutable cloudflared image digest, ACM certificate and two public-hostname routes are prepared, and the Cloudflare-to-ALB TLS/SNI/Host-header settings are verified. Then run CloudFormation lint, security review and end-to-end API/WebSocket tests. Keep DNS and production routing unchanged. This document makes no AWS changes, DNS changes, Cloudflare changes, or secret changes.
