# TradeMate Persona Hosted Inquiry Template — Design Specification

Status: design blueprint; Persona Dashboard configuration and production deployment are still required.

## Product requirement

Redesign the actual Persona-hosted inquiry experience used after a user signs the TradeMate Verification Agreement. Do not treat the TradeMate profile verification card as the target. The hosted flow itself must feel like TradeMate.

### Non-negotiable interaction rules

- No modal, popup, browser alert, or extra consent overlay inside the Persona-hosted inquiry.
- The only popup in this journey is the TradeMate Verification Agreement shown inside TradeMate **before** redirecting to Persona.
- The user types their full legal name and selects **Sign agreement & continue** in that single TradeMate agreement popup.
- Only after the signature is persisted and its PDF is saved in the private document vault may TradeMate create/resume the Persona inquiry.
- The signed agreement PDF must be listed under **Portfolio → Documents**, visibly labelled **Signed**, and support preview/download.
- Persona screens remain a normal linear hosted flow: welcome/instructions → personal details → government ID capture → selfie/liveness (if configured) → completion. Use Persona's native screens/components; do not imitate identity capture with custom HTML.
- Keep required Persona privacy, security, accessibility, and provider disclosures. Do not hide Persona notices by CSS.

## Visual direction

Use TradeMate's existing dark visual identity and amber accent.

| Token | Value | Use |
|---|---|---|
| Page background | `#080D18` | Main canvas |
| Elevated surface | `#101827` | Form/screen surfaces |
| Primary text | `#F5F7FA` | Headings and labels |
| Secondary text | `#A7B1C2` | Help and supporting copy |
| TradeMate amber | `#FF9F2E` | Primary actions, active progress, small highlights |
| Border | `#29364A` | Inputs and dividers |
| Success | `#36C98F` | Completed state only |

Typography: use a clean sans-serif close to Inter/Hanken Grotesk. Use strong, short headings, readable body text, and clear field labels. Maintain generous spacing and high contrast. The amber accent should guide attention, not fill every surface.

Branding: TradeMate shield/logo at the top; a subtle amber global/network motif may appear in the welcome hero only. Keep the background restrained so identity documents and camera capture remain legible. Retain Persona's required attribution unless Persona confirms the account plan permits its removal.

## Screen-by-screen design

### 1. Welcome / start

**Heading:** Verify your identity  
**Supporting copy:** A secure identity check helps build trust across TradeMate.  
**Primary action:** Begin verification

Show a compact progress indicator for:
1. Your details
2. Identity document
3. Selfie check

Include one concise privacy line: "Your information is encrypted and used to verify your identity." Do not add a modal or a second agreement checkbox here.

### 2. Personal details

Use Persona's native fields and configured country list. Keep labels persistent above fields; use examples only as placeholders. Ask only for fields required by the selected verification checks. Do not hard-code Nigeria as the only country unless the production verification policy explicitly restricts the service to Nigeria.

### 3. Identity document

Use Persona's native document capture component and supported document types. Keep capture instructions short and concrete. Make document framing, glare, and expiry guidance visible before camera/file capture. Avoid decorative graphics behind the camera viewport.

### 4. Selfie / liveness

Use Persona's native selfie/liveness component. Explain why a selfie is required in one sentence. Do not add a separate consent modal or additional TradeMate popup at this stage.

### 5. Completion / next step

Use a calm completion state with a clear next step. Do not claim the identity is verified merely because the user submitted the inquiry; reflect the actual Persona inquiry/verification status returned by the integration.

## Responsive behavior

- Mobile-first; single-column fields and full-width primary action.
- Keep the logo, progress indicator, and page title within the first viewport.
- Avoid horizontal scrolling and fixed overlays.
- Desktop: constrain content to a readable central column; keep camera/document capture large enough to use comfortably.
- Respect reduced-motion preferences and device safe areas.

## Persona Dashboard implementation

1. Open **Inquiries → Templates** and select the exact template whose ID is configured as `PERSONA_INQUIRY_TEMPLATE_ID`.
2. Use the Flow Editor to adjust the welcome, details, document, selfie, and completion screens.
3. Use the **Theme** editor for colors, fonts, buttons, and dark-mode behavior. Upload the approved TradeMate logo as an image asset where the screen supports it.
4. Preview the flow in Sandbox. Persona template previews always use Sandbox; a Sandbox label in the preview is expected and must not be hidden.
5. Save and publish the template version. With Persona's Deployment Manager, explicitly deploy that published version to the intended environment; publishing alone may not make it active.
6. Verify the Production deployment with a Production API key and the Production template deployment. Never use a Sandbox API key for a real user inquiry.
7. If Production is not available in the Persona organization, request Production access from Persona Support / Customer Success. Do not try to remove the sandbox notice in code.
8. Keep Persona's provider disclosure/attribution unless Persona confirms the account's plan and contract allow removal.

## Production integration release checks

- `PERSONA_API_KEY` must be the Production secret in the AWS API runtime.
- `PERSONA_INQUIRY_TEMPLATE_ID` must reference the template deployed to Production.
- `PERSONA_WEBHOOK_SECRET` must correspond to the Production webhook endpoint.
- Verify that the API can create an inquiry using the Production environment and that the hosted URL opens without the Sandbox environment warning.
- Do not paste secrets into GitHub, chat, source code, screenshots, or browser-visible fields.
- Confirm webhook status updates and return navigation against the production inquiry before enabling real users.

## Acceptance checklist

- [ ] The actual Persona-hosted screens are TradeMate branded, not just the TradeMate launch card.
- [ ] No modal or popup appears inside the Persona-hosted flow.
- [ ] The only popup is the pre-redirect TradeMate Verification Agreement.
- [ ] Signing requires a typed full legal name and an explicit sign action.
- [ ] A signed PDF is persisted before inquiry creation and appears in Portfolio → Documents as Signed.
- [ ] The Portfolio document preview and download work for the owner.
- [ ] Persona's hosted inquiry is created with Production credentials and a template version deployed to Production.
- [ ] The real Production hosted flow has no Sandbox environment notice.
- [ ] Persona-required privacy, security, accessibility, and provider disclosures remain intact.
- [ ] Inquiry submission is not misrepresented as successful identity verification.

## Source references

- Persona Help Center — Configuring your Inquiry Template: https://help.withpersona.com/articles/ETA0GIS8K60DSoiFRpA9z/
- Persona Help Center — Sandbox vs. Production Environments: https://help.withpersona.com/articles/6I2kGhfPvSuUjYq4z6tpmB/
- Persona Help Center — Change colors, fonts, logo and styles: https://help.withpersona.com/articles/1rd7JdmVeDhakxCihYUrVl/
- Persona Help Center — Deploying template versions: https://help.withpersona.com/articles/3UXQOXp87ySib6VB1DFWCO/
