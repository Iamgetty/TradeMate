# Staging origin security decision

## Current state

The current `foundation.yaml` and `services.yaml` now define an **internal** Application Load Balancer (ALB) in private application subnets. Its security group permits HTTPS ingress only from a dedicated Cloudflare Tunnel connector security group. The connector is a private Fargate service with no public IP and a dedicated execution role that reads only the tunnel-token secret. API and exchange-feed tasks accept traffic only from the ALB.

This removes direct public reachability of the ALB at the network layer. It is still infrastructure-as-code preparation only: Cloudflare dashboard hostname routes, token secret, pinned connector image digest, ACM certificate and end-to-end API/WebSocket tests remain prerequisites. Do not describe the origin as operationally protected until those are configured and verified.

## Important distinction: Cloudflare proxy IPs vs Workers egress

A static Cloudflare edge-IP allowlist is appropriate when Cloudflare's reverse proxy is the network peer connecting to the origin. It is not a safe assumption for arbitrary Cloudflare Workers subrequests: Workers egress does not generally provide a dedicated, stable per-application source-IP range that can be used as an origin allowlist. Do not copy Cloudflare's published proxy IP ranges into the ALB security group and assume that this secures Worker-to-origin requests.

## Implemented template target: private ALB behind Cloudflare Tunnel

For staging, the branch templates now define a Cloudflare Tunnel connector running as a dedicated ECS Fargate service:

1. The ALB is configured as **internal** in private application subnets; its security group has no public ingress and permits HTTPS only from the connector security group.
2. The connector has its own security group. The ALB listener accepts ingress only from that connector security group.
3. The ECS service defaults to two connector tasks in the private application subnets. The connector initiates outbound connections to Cloudflare; it needs no inbound public listener. Its private subnet egress uses the NAT gateway. Verify actual AZ placement and tunnel health after deployment.
4. Store the tunnel token in Secrets Manager. Give only the connector's ECS execution role permission to read that one secret. Never put the token in the image, task definition plaintext, GitHub, or chat.
5. Configure Cloudflare Tunnel hostnames to route the API hostname to the internal ALB API listener and the feed hostname to the internal ALB feed listener. Validate WebSocket upgrades, long-lived connections, reconnects, and graceful draining end-to-end before use.
6. Keep the ALB TLS listener and ACM certificate if the tunnel-to-origin leg uses HTTPS; validate certificate hostname/SNI and trust behavior. Alternatively use an explicitly reviewed private-origin TLS arrangement. Do not silently downgrade the origin leg to plaintext.
7. The template configures CloudWatch log retention and ECS deployment rollback. Verify connector health, actual AZ placement, capacity and tunnel-token rotation procedures operationally.

This pattern avoids treating Workers egress IPs as fixed and removes the ALB from direct public reachability. The current branch templates now include the internal ALB, connector security group, private Fargate connector service and dedicated token-read role. The Cloudflare dashboard routes and runtime validation remain manual prerequisites.

## Alternatives and constraints

- **Cloudflare proxy IP allowlisting:** only use when the request path is confirmed to originate from Cloudflare's reverse-proxy network, not assumed for Worker subrequests. Keep the official IPv4 and IPv6 ranges current and automate updates.
- **Application-layer origin authentication:** a Cloudflare Worker can add a high-entropy shared secret header, and the API can validate it using a secret injected from Secrets Manager. This requires code changes, secret rotation, constant-time comparison, redaction from logs, and negative tests. It is not sufficient unless every route and alternate entry point enforces it. The exchange-feed WebSocket handshake requires separate validation. This is a fallback, not a reason to leave a publicly reachable unauthenticated origin.
- **AWS WAF:** useful for rate limiting and request filtering, but a WAF rule by itself does not prove that a request came from the user's Cloudflare Worker unless the origin-authentication design is sound.
- **CloudFront:** not a default replacement for Cloudflare's frontend role and not required for this API/feed origin path.

## Decision gate before staging deployment

Do not deploy until the Cloudflare Tunnel token secret, immutable cloudflared image digest, ACM certificate and two public-hostname routes are prepared, and the Cloudflare-to-ALB TLS/SNI/Host-header settings are verified. Then run CloudFormation lint, security review and end-to-end API/WebSocket tests. Keep DNS and production routing unchanged. This document makes no AWS changes, DNS changes, Cloudflare changes, or secret changes.
