import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Module, NotFoundException, OnModuleDestroy, Param, Post, Patch, Delete, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { createRlsAwarePool, sessionTokenFromCookieHeader } from './database-context';
import { decodeProfileImageDataUrl, hasMatchingUploadSignature } from './upload-validation';
import { decimalToUnits, fiatCentsToQuantityUnits, productToFiatCents, unitsToDecimal } from './p2p-decimal';
import { renderTradeMateEmail } from './email-templates';
import { verifyPersonaWebhookSignature } from './persona-webhook-signature';
import { announcementBodySchema, changePasswordBodySchema, contractCreateBodySchema, contractDecisionBodySchema, contractMessageBodySchema, deletionCancelBodySchema, deletionRequestBodySchema, displayNameBodySchema, emailVerificationBodySchema, enquiryCreateBodySchema, enquiryReplyBodySchema, feedCommentBodySchema, feedModerationBodySchema, feedPinBodySchema, feedPostBodySchema, feedReactionBodySchema, feedReshareBodySchema, feedPostsQuerySchema, feedReportBodySchema, feedbackBodySchema, listingBodySchema, loginBodySchema, marketActivityQuerySchema, marketCompletedQuerySchema, marketQuotesQuerySchema, marketplaceBrowseQuerySchema, organizationCreateBodySchema, organizationDocumentManagerRoleSchema, organizationDocumentsBodySchema, organizationNameBodySchema, p2pAdBodySchema, p2pDisputeBodySchema, p2pMarketQuerySchema, p2pOrderBodySchema, p2pPaymentSentBodySchema, parseBody, parseUuidParam, preferencesBodySchema, passwordResetCompleteBodySchema, passwordResetRequestBodySchema, publicProfileBodySchema, registerBodySchema, reviewDecisionBodySchema, supportReplyBodySchema, supportTicketBodySchema, totpChallengeBodySchema, totpCodeBodySchema, sportsProfileCreateBodySchema, sportsProfileUpdateBodySchema, sportsConsentGrantBodySchema, sportsOrganizationCreateBodySchema, sportsOrganizationMembershipInviteBodySchema, sportsRepresentativeMandateCreateBodySchema, sportsRepresentativeMandateResponseBodySchema, sportsTransferOpportunityCreateBodySchema } from './validation';

const deriveScrypt = (password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SESSION_COOKIE = 'trademate_session';
const SESSION_DAYS = 7;
const PLATFORM_AGREEMENT_KEY = 'trademate-platform-user-agreement';
const PLATFORM_AGREEMENT_VERSION = '1.0';
const PERSONA_AGREEMENT_KEY = 'trademate-persona-verification-consent';
const PERSONA_AGREEMENT_VERSION = '1.0';
const PERSONA_AGREEMENT_CONTENT = `TRADEMATE IDENTITY VERIFICATION CONSENT

Version 1.0 — Effective 28 November 2026

When you choose “I agree and continue”, you ask TradeMate to start identity verification using Persona, our identity-verification service provider.

WHAT YOU ARE AGREEING TO
1. TradeMate will create or resume an identity-verification inquiry with Persona and provide the account reference and other information required to initiate that inquiry.
2. You will be directed to Persona's hosted verification experience. Information you submit there, which may include identity-document images, a photograph or selfie, and information extracted from those materials, is collected by Persona for the checks configured for this inquiry.
3. Persona processes information under its own terms and privacy documentation. Review Persona's current privacy information before submitting documents: https://withpersona.com/legal/privacy-policy
4. TradeMate receives inquiry status and verification outcomes through the integration. TradeMate does not receive or store your raw identity-document images through this inquiry-status integration.
5. Verification helps establish identity for platform trust and safety. It is not a guarantee of honesty, authority, financial standing, eligibility or future conduct.
6. Do not submit another person's identity information unless you are legally authorized to do so.

YOUR CHOICE AND RECORD
You may decline. If you decline, TradeMate will not start a new Persona inquiry from this request. You can return to this step later. If you accept, TradeMate records the consent version, integrity hash, time, account and relevant technical audit information, and saves a copy of this consent and its acceptance record in your private document vault.

This consent describes the intended TradeMate integration flow. The precise checks, data categories, processing locations and retention periods depend on Persona's current service terms and the configuration of the verification inquiry. Review Persona's privacy information before proceeding. This text requires legal and privacy review for the jurisdictions in which TradeMate operates and does not replace a privacy notice or independent electronic-signature process.`;
const PLATFORM_AGREEMENT_CONTENT = `TradeMate Platform User Agreement

Version 1.0 — Effective 28 November 2026

WELCOME TO TRADEMATE
TradeMate exists to make serious business and marketplace relationships clearer, more transparent and more trustworthy. It brings people, businesses and organizations together to discover opportunities, communicate, negotiate and build relationships with greater confidence.

By selecting “I agree and continue”, you confirm that you have read and accept this Agreement. Your acceptance is recorded against your account, together with the version of this Agreement and the time of acceptance.

1. YOUR ACCOUNT AND INFORMATION
Provide information that is accurate, current and not misleading. Keep your sign-in credentials private, use your account responsibly and tell us promptly if you believe someone else has accessed it. Do not impersonate another person, create deceptive accounts or use another person's identity or documents without proper authority.

2. HONEST AND RESPONSIBLE USE
Use TradeMate for lawful, genuine business and marketplace activity. Do not use the platform to deceive, defraud, harass, threaten, manipulate, facilitate unlawful activity or misrepresent a person, organization, product, service, opportunity or transaction. Do not upload false, misleading, stolen or unlawfully obtained documents. You must have the right and authority to share information and documents you submit.

3. IDENTITY, ORGANIZATIONS AND VERIFICATION
TradeMate may ask you or an organization you represent to complete identity, business or other verification checks. Provide truthful information and cooperate with reasonable requests. Verification is an identity and risk-checking process; it does not guarantee a person's honesty, financial position, professional ability, ownership claims or future conduct, and it does not replace your own due diligence. Do not claim to represent an organization unless you are authorized to do so.

4. MARKETPLACE ACTIVITY, NEGOTIATIONS AND CONTRACTS
Review the details of an opportunity, offer, negotiation or transaction before acting. Understand the parties, scope, price, currency, timing, obligations, delivery terms and relevant conditions. TradeMate provides tools to help parties discover one another, communicate and manage commercial workflows. Unless a specific service clearly says otherwise, TradeMate is not a party to agreements between users and does not guarantee another user will perform, pay, deliver or meet a stated qualification. A message, draft, uploaded file, proposal or in-platform status is not a completed or legally signed contract unless the relevant parties complete the applicable agreement and signature process. Do not describe a document as signed, approved, official or complete when it is not. Obtain independent legal, financial, tax, regulatory or professional advice where appropriate.

5. DOCUMENTS, PRIVACY AND PERMISSIONS
Documents and information you submit may be stored and made available through your TradeMate document area. Access is controlled according to the document's purpose and permissions associated with your account, organization or transaction. Do not access, disclose, copy or use another person's or organization's private information without permission. You authorize TradeMate to process information and documents as reasonably necessary to provide, secure, support and improve the platform, comply with legal obligations and address abuse or disputes, subject to applicable privacy requirements and TradeMate's privacy notice. Share another person's personal information only when you have a lawful basis and authority.

6. PLATFORM INTEGRITY AND SECURITY
Do not probe, disrupt, overload, reverse engineer or bypass platform security or access controls. Do not introduce malicious code, scrape private information, interfere with another user's access or misuse platform features. TradeMate may investigate suspicious activity, restrict access or preserve relevant records where reasonably necessary to protect users, the platform or transaction integrity, or to comply with law.

7. AVAILABILITY AND CHANGES
We work to keep TradeMate reliable and secure, but uninterrupted availability cannot be guaranteed. Features may change, be suspended or withdrawn for maintenance, security, legal or operational reasons. We may update this Agreement. When a material update requires renewed acceptance, we will present the updated version and record your decision. Earlier acceptance does not count as acceptance of a later version.

8. SUSPENSION AND ACCOUNT CLOSURE
We may limit or suspend access where we reasonably believe an account is compromised, these rules have been breached, activity presents a risk to users or the platform, or law requires it. Where appropriate, we will explain the action and any available review process. You may stop using TradeMate and request account closure through the available account process. Certain records may need to be retained for security, audit, dispute-resolution or legal reasons.

9. NO BLANKET GUARANTEE
TradeMate provides tools and information to support better business interactions. We do not promise that every user, listing, opportunity, document, statement or transaction is accurate, suitable or risk-free. Verify important claims and make decisions using your own judgment. Nothing in this Agreement excludes or limits a right or liability that cannot lawfully be excluded or limited under applicable law.

10. YOUR ACCEPTANCE
By selecting “I agree and continue”, you confirm that you have read and understood this Agreement; information and documents you provide will be truthful and shared with proper authority; you will use TradeMate lawfully, respectfully and in good faith; you understand verification is not a guarantee and you must assess counterparties and transactions for yourself; and you consent to TradeMate recording your acceptance electronically, including this Agreement version, its integrity hash, the time of acceptance and relevant technical audit information.

If you do not agree, do not continue using the platform. Sign out and contact TradeMate support if you need help.

This platform-use agreement is not a substitute for a jurisdiction-specific privacy notice, regulated financial-services disclosure or transaction-specific contract. TradeMate should obtain legal review for the jurisdictions in which it operates before treating this text as its final binding terms.`;

const buildAgreementAcceptancePdf = (agreementKey: string, agreementVersion: string, agreementTitle: string, agreementContent: string, acceptedAt: Date, acceptanceId: string, userId: string, agreementSha256: string, acceptanceMethod = 'Explicit in-app confirmation'): Buffer => {
  const evidence = [
    'ELECTRONIC ACCEPTANCE RECORD',
    '',
    'Acceptance ID: ' + acceptanceId,
    'Account ID: ' + userId,
    'Accepted at (UTC): ' + acceptedAt.toISOString(),
    'Acceptance method: ' + acceptanceMethod,
    'Agreement key: ' + agreementKey,
    'Agreement version: ' + agreementVersion,
    'Agreement SHA-256: ' + agreementSha256,
    '',
    'This record documents the account holder\'s explicit in-app acceptance.',
    'It is an electronic acceptance record, not a cryptographic signature',
    'or a certificate issued by an independent electronic-signature provider.',
    '',
    'Agreement title: ' + agreementTitle, '', '--- AGREEMENT TEXT ---',
    '',
    ...agreementContent.split(/\r?\n/),
  ];
  const ascii = (value: string) => value
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-').replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '');
  const lines: string[] = [];
  for (const raw of evidence) {
    const line = ascii(raw);
    if (!line) { lines.push(''); continue; }
    let remaining = line;
    while (remaining.length > 92) {
      let splitAt = remaining.lastIndexOf(' ', 92);
      if (splitAt < 40) splitAt = 92;
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    lines.push(remaining);
  }
  const pageLines: string[][] = [];
  for (let index = 0; index < lines.length; index += 52) pageLines.push(lines.slice(index, index + 52));
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const pageRefs: string[] = [];
  pageLines.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    pageRefs.push(pageId + ' 0 R');
    const commands = ['BT', '/F1 9 Tf', '48 748 Td', '13 TL'];
    page.forEach((line, lineIndex) => {
      if (lineIndex) commands.push('T*');
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      commands.push('(' + escaped + ') Tj');
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentId + ' 0 R >>';
    objects[contentId] = '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream';
  });
  objects[2] = '<< /Type /Pages /Kids [' + pageRefs.join(' ') + '] /Count ' + pageRefs.length + ' >>';
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'ascii');
    pdf += id + ' 0 obj\n' + objects[id] + '\nendobj\n';
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id++) pdf += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
};
const saveContractVaultRecord = async (client: PoolClient, contract: Record<string, unknown>, recordStatus: string, ownerUserId: string) => {
  const pdf = buildContractRecordPdf(contract, recordStatus);
  const safeStatus = recordStatus.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const fileName = 'TradeMate-Contract-' + safeStatus + '-' + String(contract.id) + '.pdf';
  const hash = createHash('sha256').update(pdf).digest('hex');
  await client.query(
    'INSERT INTO user_documents (owner_user_id, source_type, source_id, document_type, document_status, visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata) VALUES ($1,\'contract\',$2,\'contract\',\'generated\',\'contract_participants\',$3,\'application/pdf\',$4,$5,$6,$7::jsonb)',
    [ownerUserId, contract.id, fileName, pdf.length, hash, pdf, JSON.stringify({ record_type: 'contract_status_record', contract_status: String(contract.status || recordStatus), generated_at: new Date().toISOString(), signature_status: 'not_signed' })],
  );
};


const buildPersonaVerificationEventPdf = (event: {
  eventId: string; eventName: string; inquiryId: string; inquiryStatus: string | null;
  eventCreatedAt: Date | null; receivedAt: Date; userId: string; payloadSha256: string;
}): Buffer => {
  const lines = [
    'TRADEMATE IDENTITY VERIFICATION EVENT RECORD', '',
    'Account reference: ' + event.userId,
    'Persona inquiry reference: ' + event.inquiryId,
    'Persona event reference: ' + event.eventId,
    'Event: ' + event.eventName,
    'Inquiry status reported: ' + (event.inquiryStatus || 'Not supplied'),
    'Event time (UTC): ' + (event.eventCreatedAt?.toISOString() || 'Not supplied'),
    'Received by TradeMate (UTC): ' + event.receivedAt.toISOString(),
    'Webhook payload SHA-256: ' + event.payloadSha256,
    '',
    'RECORD SCOPE AND LIMITATIONS',
    'This record documents a signed Persona webhook event received by TradeMate.',
    'It is not an identity document, proof of identity, or a guarantee of identity.',
    'It does not represent a legal determination or approval beyond the event shown.',
    'TradeMate does not copy raw identity images or biometric source files into this record.',
  ].map((line) => line.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[—–]/g, '-').replace(/[^\x20-\x7E]/g, ''));
  const escapePdf = (line: string) => line.split('\\').join('\\\\').split('(').join('\\(').split(')').join('\\)');
  const commands = ['BT', '/F1 10 Tf', '48 748 Td', '14 TL'];
  lines.forEach((line, index) => { if (index) commands.push('T*'); commands.push('(' + escapePdf(line) + ') Tj'); });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += (index + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (let index = 1; index <= 5; index++) pdf += String(offsets[index]).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
};

const savePersonaVerificationEventEvidence = async (inquiryId: string): Promise<void> => {
  if (!databasePool) return;
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const mapping = await client.query(
      'SELECT user_id FROM persona_user_inquiries WHERE inquiry_id = $1 FOR UPDATE',
      [inquiryId],
    );
    if (!mapping.rowCount) { await client.query('COMMIT'); return; }
    const userId = String(mapping.rows[0].user_id);
    const events = await client.query(
      `SELECT e.event_id, e.event_name, e.inquiry_id, e.inquiry_status,
              e.event_created_at, e.received_at, e.payload_sha256
       FROM persona_webhook_events e
       LEFT JOIN persona_webhook_event_documents d ON d.event_id = e.event_id
       WHERE e.inquiry_id = $1 AND d.event_id IS NULL
       ORDER BY e.event_created_at ASC NULLS LAST, e.received_at ASC
       LIMIT 50`,
      [inquiryId],
    );
    for (const event of events.rows) {
      const receivedAt = event.received_at instanceof Date ? event.received_at : new Date(event.received_at);
      const eventCreatedAt = event.event_created_at
        ? (event.event_created_at instanceof Date ? event.event_created_at : new Date(event.event_created_at))
        : null;
      const pdf = buildPersonaVerificationEventPdf({
        eventId: String(event.event_id), eventName: String(event.event_name),
        inquiryId: String(event.inquiry_id), inquiryStatus: event.inquiry_status ? String(event.inquiry_status) : null,
        eventCreatedAt, receivedAt, userId, payloadSha256: String(event.payload_sha256),
      });
      const fileName = 'TradeMate-Persona-Verification-' + String(event.event_id) + '.pdf';
      const digest = createHash('sha256').update(pdf).digest('hex');
      const document = await client.query(
        `INSERT INTO user_documents
          (owner_user_id, source_type, source_id, document_type, document_status, visibility,
           file_name, mime_type, file_size, file_sha256, file_data, metadata)
         VALUES ($1,'identity_verification',$1,'identity','generated','private',$2,
                 'application/pdf',$3,$4,$5,$6::jsonb)
         RETURNING id`,
        [userId, fileName, pdf.length, digest, pdf, JSON.stringify({
          record_type: 'persona_verification_event', persona_event_id: event.event_id,
          persona_event_name: event.event_name, persona_inquiry_id: event.inquiry_id,
          inquiry_status: event.inquiry_status, event_created_at: event.event_created_at,
          received_at: event.received_at, payload_sha256: event.payload_sha256,
          raw_identity_images_included: false,
        })],
      );
      await client.query(
        'INSERT INTO persona_webhook_event_documents (event_id, user_id, document_id) VALUES ($1,$2,$3)',
        [event.event_id, userId, document.rows[0].id],
      );
      await client.query(
        `INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
         VALUES ($1,'persona.verification_event_recorded','user_document',$2,$3::jsonb)`,
        [userId, document.rows[0].id, JSON.stringify({
          persona_event_id: event.event_id, event_name: event.event_name,
          inquiry_id: event.inquiry_id, status: event.inquiry_status,
        })],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const buildAccountRegistrationRecordPdf = (user: Record<string, unknown>, registeredAt = new Date()): Buffer => {
  const rawLines = [
    'TRADEMATE ACCOUNT REGISTRATION RECORD', '',
    'Registered at (UTC): ' + registeredAt.toISOString(),
    'Account reference: ' + String(user.id || ''),
    'Account holder: ' + String(user.display_name || ''),
    'Email address: ' + String(user.email || ''),
    'Initial account status: ' + String(user.status || 'pending email verification'),
    '', 'REGISTRATION SCOPE',
    'This record confirms creation of a TradeMate account profile.',
    'Email ownership had not yet been confirmed when this record was generated.',
    'It is not proof of identity, legal name, or verification approval.',
  ];
  const lines = rawLines.map((line) => line.replace(/[^\x20-\x7E]/g, ''));
  const escapePdf = (line: string) => line.split('\\').join('\\\\').split('(').join('\\(').split(')').join('\\)');
  const commands = ['BT', '/F1 10 Tf', '48 748 Td', '14 TL'];
  lines.forEach((line, index) => { if (index) commands.push('T*'); commands.push('(' + escapePdf(line) + ') Tj'); });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = Buffer.byteLength(pdf, 'ascii'); pdf += id + ' 0 obj\n' + objects[id] + '\nendobj\n'; }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id++) pdf += offsets[id].toString().padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
};

const buildEmailVerificationRecordPdf = (user: Record<string, unknown>, verifiedAt = new Date()): Buffer => {
  const rawLines = [
    'TRADEMATE EMAIL VERIFICATION RECORD', '',
    'Verified at (UTC): ' + verifiedAt.toISOString(),
    'Account reference: ' + String(user.id || ''),
    'Verified email: ' + String(user.email || ''),
    'Account display name: ' + String(user.display_name || ''),
    'Country code: ' + String(user.country_code || ''),
    '', 'VERIFICATION SCOPE',
    'This record confirms that the account email address completed TradeMate email verification.',
    'It does not verify the account holder identity, organization status, or legal authority.',
  ];
  const lines = rawLines.map((line) => line.replace(/[^\x20-\x7E]/g, ''));
  const escapePdf = (line: string) => line.split('\\').join('\\\\').split('(').join('\\(').split(')').join('\\)');
  const commands = ['BT', '/F1 10 Tf', '48 748 Td', '14 TL'];
  lines.forEach((line, index) => { if (index) commands.push('T*'); commands.push('(' + escapePdf(line) + ') Tj'); });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = Buffer.byteLength(pdf, 'ascii'); pdf += id + ' 0 obj\n' + objects[id] + '\nendobj\n'; }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id++) pdf += offsets[id].toString().padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
};

const buildOrganizationRegistrationPdf = (organization: Record<string, unknown>, ownerUserId: string, recordedAt = new Date()): Buffer => {
  const rawLines = [
    'TRADEMATE ORGANIZATION REGISTRATION RECORD', '',
    'Record generated (UTC): ' + recordedAt.toISOString(),
    'Organization reference: ' + String(organization.id || ''),
    'Organization name: ' + String(organization.name || ''),
    'Organization type: ' + String(organization.organization_type || ''),
    'Country code: ' + String(organization.country_code || ''),
    'Default currency: ' + String(organization.default_currency || ''),
    'Initial platform status: ' + String(organization.status || 'pending'),
    'Registered by account: ' + ownerUserId,
    '', 'IMPORTANT STATUS NOTICE',
    'This record confirms that an organization profile was created on TradeMate.',
    'It is not a certificate of incorporation, proof of registration with a government authority,',
    'verification approval, or a signed legal agreement.',
  ];
  const lines = rawLines.map((line) => line.replace(/[^\x20-\x7E]/g, ''));
  const escapePdf = (line: string) => line.split('\\').join('\\\\').split('(').join('\\(').split(')').join('\\)');
  const commands = ['BT', '/F1 10 Tf', '48 748 Td', '14 TL'];
  lines.forEach((line, index) => { if (index) commands.push('T*'); commands.push('(' + escapePdf(line) + ') Tj'); });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = Buffer.byteLength(pdf, 'ascii'); pdf += id + ' 0 obj\n' + objects[id] + '\nendobj\n'; }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id++) pdf += offsets[id].toString().padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
};

const buildP2PTradeReceiptPdf = (trade: Record<string, unknown>, generatedAt = new Date()): Buffer => {
  const rawLines = [
    'TRADEMATE P2P TRANSACTION RECEIPT', '',
    'Receipt generated (UTC): ' + generatedAt.toISOString(),
    'Transaction reference: ' + String(trade.id || ''),
    'Status: COMPLETED — both parties recorded completion',
    'Completed at (UTC): ' + String(trade.completed_at || generatedAt.toISOString()),
    'Buyer marked payment sent (UTC): ' + String(trade.buyer_payment_sent_at || 'Not recorded'),
    'Seller confirmed receipt (UTC): ' + String(trade.seller_payment_confirmed_at || trade.completed_at || generatedAt.toISOString()),
    'Buyer account: ' + String(trade.buyer_user_id || ''),
    'Buyer name: ' + String(trade.buyer_name || 'Not available'),
    'Seller account: ' + String(trade.seller_user_id || ''),
    'Seller name: ' + String(trade.seller_name || 'Not available'),
    'Asset: ' + String(trade.asset_code || ''),
    'Fiat currency: ' + String(trade.fiat_code || ''),
    'Price per asset: ' + String(trade.price || ''),
    'Quantity: ' + String(trade.quantity || ''),
    'Fiat total: ' + String(trade.fiat_total || '') + ' ' + String(trade.fiat_code || ''),
    'Order reference: ' + String(trade.order_id || ''),
    '',
    'RECEIPT SCOPE',
    'This receipt records the transaction details and completion status stored in TradeMate.',
    'TradeMate does not custody funds or provide escrow. This document is not proof of a bank transfer,',
    'payment receipt from a financial institution, guarantee, or independent verification of funds.',
  ];
  const ascii = (value: string) => value.replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E]/g, '');
  const lines: string[] = [];
  for (const raw of rawLines) {
    const line = ascii(raw);
    if (!line) { lines.push(''); continue; }
    let remaining = line;
    while (remaining.length > 92) {
      let splitAt = remaining.lastIndexOf(' ', 92);
      if (splitAt < 40) splitAt = 92;
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    lines.push(remaining);
  }
  const pageLines: string[][] = [];
  for (let index = 0; index < lines.length; index += 52) pageLines.push(lines.slice(index, index + 52));
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const pageRefs: string[] = [];
  pageLines.forEach((page, index) => {
    const pageId = 4 + index * 2, contentId = pageId + 1;
    pageRefs.push(pageId + ' 0 R');
    const commands = ['BT', '/F1 9 Tf', '48 748 Td', '13 TL'];
    page.forEach((line, lineIndex) => {
      if (lineIndex) commands.push('T*');
      commands.push('(' + line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ') Tj');
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentId + ' 0 R >>';
    objects[contentId] = '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream';
  });
  objects[2] = '<< /Type /Pages /Kids [' + pageRefs.join(' ') + '] /Count ' + pageRefs.length + ' >>';
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'ascii');
    pdf += id + ' 0 obj\n' + objects[id] + '\nendobj\n';
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id++) pdf += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
};
const saveP2PTradeReceiptVaultDocuments = async (client: PoolClient, trade: Record<string, unknown>) => {
  const generatedAt = new Date();
  for (const ownerUserId of [String(trade.buyer_user_id), String(trade.seller_user_id)]) {
    const existing = await client.query(
      'SELECT document_id FROM p2p_trade_receipt_documents WHERE p2p_trade_id = $1 AND user_id = $2',
      [trade.id, ownerUserId],
    );
    if (existing.rowCount) continue;
    const pdf = buildP2PTradeReceiptPdf(trade, generatedAt);
    const hash = createHash('sha256').update(pdf).digest('hex');
    const fileName = 'TradeMate-P2P-Receipt-' + String(trade.id) + '.pdf';
    const document = await client.query(
      "INSERT INTO user_documents (owner_user_id, source_type, source_id, document_type, document_status, visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata) VALUES ($1,'marketplace_transaction',$2,'receipt','generated','private',$3,'application/pdf',$4,$5,$6,$7::jsonb) RETURNING id",
      [ownerUserId, trade.id, fileName, pdf.length, hash, pdf, JSON.stringify({ record_type: 'p2p_completed_trade_receipt', transaction_reference: String(trade.id), completed_at: trade.completed_at, generated_at: generatedAt.toISOString(), payment_reference_included: false })],
    );
    await client.query(
      'INSERT INTO p2p_trade_receipt_documents (p2p_trade_id, user_id, document_id) VALUES ($1,$2,$3)',
      [trade.id, ownerUserId, document.rows[0].id],
    );
  }
};
const buildContractRecordPdf = (contract: Record<string, unknown>, recordStatus: string, recordedAt = new Date()): Buffer => {
  const amount = (Number(contract.amount_minor_units || 0) / 100).toFixed(2);
  const rawLines = [
    'TRADEMATE CONTRACT RECORD', '',
    'Record status: ' + recordStatus.toUpperCase(),
    'Record generated (UTC): ' + recordedAt.toISOString(),
    'Contract reference: ' + String(contract.id || ''),
    'Listing reference: ' + String(contract.listing_id || ''),
    'Title: ' + String(contract.title || ''),
    'Buyer account: ' + String(contract.buyer_user_id || ''),
    'Seller organization: ' + String(contract.seller_organization_id || ''),
    'Proposed amount: ' + amount + ' ' + String(contract.currency_code || ''),
    'Requested start date: ' + String(contract.requested_start_date || 'Not specified'),
    'Requested completion date: ' + String(contract.requested_completion_date || 'Not specified'),
    '', 'SCOPE', String(contract.scope || ''), '', 'TERMS', String(contract.terms || ''),
    '', 'IMPORTANT STATUS NOTICE',
    'This generated record reflects the contract proposal status shown above.',
    'It is not a signed agreement, digital signature, or proof of acceptance.',
    'Any legally binding execution requirements must be completed separately.',
  ];
  const lines: string[] = [];
  for (const raw of rawLines) {
    const normalized = raw.replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
      .replace(/[—–]/g, '-').replace(/…/g, '...')
      .replace(/[^\x20-\x7E]/g, '');
    if (!normalized) { lines.push(''); continue; }
    let remaining = normalized;
    while (remaining.length > 88) {
      let splitAt = remaining.lastIndexOf(' ', 88);
      if (splitAt < 35) splitAt = 88;
      lines.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    lines.push(remaining);
  }
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 52) pages.push(lines.slice(i, i + 52));
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const pageRefs: string[] = [];
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2, contentId = pageId + 1;
    pageRefs.push(pageId + ' 0 R');
    const commands = ['BT', '/F1 9 Tf', '48 748 Td', '13 TL'];
    page.forEach((line, lineIndex) => {
      if (lineIndex) commands.push('T*');
      commands.push('(' + line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ') Tj');
    });
    commands.push('ET');
    const stream = commands.join('\n');
    objects[pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentId + ' 0 R >>';
    objects[contentId] = '<< /Length ' + Buffer.byteLength(stream, 'ascii') + ' >>\nstream\n' + stream + '\nendstream';
  });
  objects[2] = '<< /Type /Pages /Kids [' + pageRefs.join(' ') + '] /Count ' + pageRefs.length + ' >>';
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'ascii');
    pdf += id + ' 0 obj\n' + objects[id] + '\nendobj\n';
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id++) pdf += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(pdf, 'ascii');
};

const passwordHash = async (password: string) => {
  const salt = randomBytes(16);
  const derived = await deriveScrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', '16384', '8', '1', salt.toString('hex'), derived.toString('hex')].join(String.fromCharCode(36));
};
const passwordMatches = async (password: string, encoded: string) => {
  const parts = encoded.split(String.fromCharCode(36));
  if (parts.length !== 6 || parts[0] !== 'scrypt' || parts[1] !== '16384' || parts[2] !== '8' || parts[3] !== '1') return false;
  try {
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = await deriveScrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(actual, expected);
  } catch { return false; }
};

const totpEncryptionKey = () => {
  const raw = process.env.TOTP_ENCRYPTION_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error('TOTP_ENCRYPTION_KEY must be configured as 64 hexadecimal characters.');
  return Buffer.from(raw, 'hex');
};
const encryptTotpSecret = (secret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', totpEncryptionKey(), iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
};
const decryptTotpSecret = (value: string) => {
  const [ivHex, tagHex, encryptedHex] = value.split(':');
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid encrypted authenticator secret.');
  const decipher = createDecipheriv('aes-256-gcm', totpEncryptionKey(), Buffer.from(ivHex, 'hex'), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};
const base32Encode = (input: Buffer) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, output = '';
  for (const byte of input) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
};
const base32Decode = (input: string) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of input.replace(/=+$/g, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(output);
};
const verifyTotp = (secret: string, code: string): number | null => {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 30000);
  for (let offset = -1; offset <= 1; offset++) {
    const matchedCounter = counter + offset;
    if (matchedCounter < 0) continue;
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(matchedCounter));
    const digest = createHmac('sha1', key).update(buffer).digest();
    const position = digest[digest.length - 1] & 15;
    const binary = ((digest[position] & 127) << 24) | ((digest[position + 1] & 255) << 16) | ((digest[position + 2] & 255) << 8) | (digest[position + 3] & 255);
    const expected = String(binary % 1000000).padStart(6, '0');
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return matchedCounter;
  }
  return null;
};

const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');

const sendTransactionalEmail = async (to: string, subject: string, html: string) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const senderAddress = from?.match(/<([^<>]+)>/)?.[1] ?? from;
  const brandedFrom = senderAddress ? `TradeMate <${senderAddress}>` : from;
  if (!apiKey || !from) {
    console.warn('[email] Resend is not configured; transactional email was not sent.');
    return false;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: brandedFrom, to: [to], subject, html: renderTradeMateEmail(subject, html) }),
    });
    if (!response.ok) {
      console.error('[email] Resend delivery failed:', response.status, (await response.text()).slice(0, 500));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email] Resend request failed:', error);
    return false;
  }
};

const notifySuccessfulSignIn = async (email: string) => {
  const delivered = await sendTransactionalEmail(
    email,
    'New sign-in to your TradeMate account',
    '<p>A sign-in to your TradeMate account was completed.</p><p>If this was not you, change your password and review your active sessions immediately.</p>',
  );
  if (!delivered) {
    console.warn('[auth] Sign-in succeeded, but its security notification email was not delivered.');
  }
};

const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
const sessionTokenFrom = (request: Request) => sessionTokenFromCookieHeader(request.headers.cookie);
const databasePool = process.env.DATABASE_URL
  ? createRlsAwarePool(new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
      connectionTimeoutMillis: 5000,
      max: 5,
    }))
  : null;

const resolvePresentedSessionUserDigest = async (digest: string) => {
  if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
  return databasePool.query<{ id: string }>(
    'SELECT resolved_user_id::text AS id FROM trademate_private.resolve_presented_session($1)',
    [digest],
  );
};
const resolvePresentedSessionUser = (token: string) => resolvePresentedSessionUserDigest(tokenDigest(token));

const enforceTotpRateLimit = async (request: Request, userId: string) => {
  if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
  const key = tokenDigest((request.ip || 'unknown') + '|totp-action|' + userId);
  const result = await databasePool.query(
    "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= 10 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
    [key],
  );
  if (result.rows[0].attempts > 10 || (result.rows[0].blocked_until && new Date(result.rows[0].blocked_until).getTime() > Date.now())) {
    throw new HttpException('Too many authenticator attempts. Please wait 15 minutes before trying again.', HttpStatus.TOO_MANY_REQUESTS);
  }
  return key;
};

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'trademate-api', stage: 'marketplace-foundation', timestamp: new Date().toISOString() };
  }

  @Get('health/database')
  async databaseHealth() {
    if (!databasePool) {
      return { status: 'not_configured', database: { configured: false, connected: false } };
    }
    try {
      await databasePool.query('SELECT 1');
      return { status: 'ok', database: { configured: true, connected: true } };
    } catch {
      return { status: 'error', database: { configured: true, connected: false } };
    }
  }
}


@Controller('integrations/persona')
class PersonaWebhookController {
  @Post('webhook')
  @HttpCode(200)
  async receive(@Req() request: Request, @Body() body: unknown) {
    const secret = process.env.PERSONA_WEBHOOK_SECRET;
    if (!secret) throw new HttpException('Persona webhook integration is not configured.', HttpStatus.SERVICE_UNAVAILABLE);

    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
    const signature = request.get('persona-signature') || '';
    if (!rawBody?.length || !verifyPersonaWebhookSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid Persona webhook signature.');
    }
    if (!isRecord(body) || !isRecord(body.data) || !isRecord(body.data.attributes)) {
      throw new BadRequestException('Invalid Persona webhook payload.');
    }

    const eventId = typeof body.data.id === 'string' ? body.data.id : '';
    const attributes = body.data.attributes;
    const eventName = typeof attributes.name === 'string' ? attributes.name : '';
    const supportedEvents = new Set([
      'inquiry.created', 'inquiry.started', 'inquiry.completed', 'inquiry.approved',
      'inquiry.declined', 'inquiry.marked-for-review', 'inquiry.failed', 'inquiry.expired',
    ]);
    if (!/^evt_[A-Za-z0-9]+$/.test(eventId) || !supportedEvents.has(eventName)) {
      throw new BadRequestException('Unsupported Persona webhook event.');
    }

    const eventPayload = isRecord(attributes.payload) ? attributes.payload : null;
    const inquiry = eventPayload && isRecord(eventPayload.data) ? eventPayload.data : null;
    const inquiryId = inquiry && typeof inquiry.id === 'string' ? inquiry.id : '';
    const inquiryAttributes = inquiry && isRecord(inquiry.attributes) ? inquiry.attributes : null;
    const inquiryStatus = inquiryAttributes && typeof inquiryAttributes.status === 'string'
      ? inquiryAttributes.status : null;
    const referenceId = inquiryAttributes && typeof inquiryAttributes['reference-id'] === 'string'
      ? inquiryAttributes['reference-id'] : '';
    const eventCreatedAt = typeof attributes['created-at'] === 'string'
      ? new Date(attributes['created-at']) : null;
    if (!/^inq_[A-Za-z0-9]+$/.test(inquiryId) || (eventCreatedAt && !Number.isFinite(eventCreatedAt.getTime()))) {
      throw new BadRequestException('Persona webhook is missing a valid inquiry reference.');
    }
    if (!databasePool) throw new HttpException('TradeMate database is unavailable.', HttpStatus.SERVICE_UNAVAILABLE);

    const digest = createHash('sha256').update(rawBody).digest('hex');
    const inserted = await databasePool.query(
      `INSERT INTO persona_webhook_events
         (event_id, event_name, inquiry_id, inquiry_status, event_created_at, payload_sha256)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventName, inquiryId, inquiryStatus, eventCreatedAt, digest],
    );
    const statusByEvent: Record<string, string> = {
      'inquiry.created': 'pending', 'inquiry.started': 'in_progress', 'inquiry.completed': 'submitted',
      'inquiry.approved': 'approved', 'inquiry.declined': 'declined', 'inquiry.marked-for-review': 'review',
      'inquiry.failed': 'failed', 'inquiry.expired': 'expired',
    };
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referenceId)) {
      await databasePool.query(
        `INSERT INTO persona_user_inquiries (user_id, inquiry_id, status)
         SELECT id, $2, $3 FROM users WHERE id = $1 AND status = 'active'
         ON CONFLICT (inquiry_id) DO NOTHING`,
        [referenceId, inquiryId, statusByEvent[eventName]],
      );
    }
    await databasePool.query(
      `UPDATE persona_user_inquiries SET status = $1, updated_at = now(),
       approved_at = CASE WHEN $1 = 'approved' THEN COALESCE(approved_at, now()) ELSE approved_at END
       WHERE inquiry_id = $2 AND (status <> 'approved' OR $1 = 'approved')`,
      [statusByEvent[eventName], inquiryId]);
    await savePersonaVerificationEventEvidence(inquiryId);
    return { received: true, duplicate: inserted.rowCount === 0 };
  }
}


function parsePersonaHostedLink(value: string): URL {
  // Persona's API can return surrounding whitespace; normalize it before parsing.
  // Convert URL parser failures into a deliberate upstream error instead of
  // leaking a runtime TypeError to the browser.
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new HttpException('Persona returned an invalid verification link. Please try again.', HttpStatus.BAD_GATEWAY);
  }
  if (parsed.protocol !== 'https:' || !['inquiry.withpersona.com', 'withpersona.com', 'go.perso.na'].includes(parsed.hostname)) {
    throw new HttpException('Persona returned an unsafe verification link.', HttpStatus.BAD_GATEWAY);
  }
  return parsed;
}


@Controller('integrations/persona')
class PersonaInquiryController {
  private async currentUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to verify your identity.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session.rows[0].id as string;
  }

  @Get('agreement')
  async agreement(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const accepted = await databasePool!.query(
      'SELECT 1 FROM persona_verification_agreement_acceptances WHERE user_id = $1 AND agreement_key = $2 AND agreement_version = $3 AND agreement_sha256 = $4 LIMIT 1',
      [userId, PERSONA_AGREEMENT_KEY, PERSONA_AGREEMENT_VERSION, createHash('sha256').update(PERSONA_AGREEMENT_CONTENT, 'utf8').digest('hex')],
    );
    return { required: accepted.rowCount === 0, agreement: {
      key: PERSONA_AGREEMENT_KEY, version: PERSONA_AGREEMENT_VERSION,
      sha256: createHash('sha256').update(PERSONA_AGREEMENT_CONTENT, 'utf8').digest('hex'),
      title: 'TradeMate Identity Verification Consent', content: PERSONA_AGREEMENT_CONTENT,
    } };
  }

  @Post('agreement/accept')
  @HttpCode(200)
  async acceptAgreement(@Req() request: Request, @Body() body: { version?: string; accepted?: boolean }) {
    const userId = await this.currentUser(request);
    if (body?.accepted !== true || body?.version !== PERSONA_AGREEMENT_VERSION) {
      throw new BadRequestException('Review the identity verification consent and explicitly accept its current version.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const agreementSha256 = createHash('sha256').update(PERSONA_AGREEMENT_CONTENT, 'utf8').digest('hex');
      const result = await client.query(
        `INSERT INTO persona_verification_agreement_acceptances
          (user_id, agreement_key, agreement_version, agreement_sha256, acceptance_method, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'explicit_in_app', $5, $6)
         ON CONFLICT (user_id, agreement_key, agreement_version) DO NOTHING
         RETURNING id, accepted_at`,
        [userId, PERSONA_AGREEMENT_KEY, PERSONA_AGREEMENT_VERSION, agreementSha256,
          request.ip || null, request.get('user-agent')?.slice(0, 500) || null],
      );
      if (result.rowCount) {
        const acceptance = result.rows[0];
        const pdf = buildAgreementAcceptancePdf(PERSONA_AGREEMENT_KEY, PERSONA_AGREEMENT_VERSION,
          'TradeMate Identity Verification Consent', PERSONA_AGREEMENT_CONTENT,
          new Date(acceptance.accepted_at), acceptance.id, userId, agreementSha256);
        const pdfSha256 = createHash('sha256').update(pdf).digest('hex');
        await client.query(
          `INSERT INTO user_documents
            (owner_user_id, source_type, source_id, document_type, document_status, visibility,
             file_name, mime_type, file_size, file_sha256, file_data, metadata)
           VALUES ($1, 'account', $2, 'agreement', 'generated', 'private',
                   'TradeMate-Identity-Verification-Consent-v1.0.pdf', 'application/pdf',
                   $3, $4, $5, $6::jsonb)`,
          [userId, acceptance.id, pdf.length, pdfSha256, pdf,
            JSON.stringify({ agreement_key: PERSONA_AGREEMENT_KEY, agreement_version: PERSONA_AGREEMENT_VERSION,
              agreement_sha256: agreementSha256, acceptance_id: acceptance.id,
              accepted_at: new Date(acceptance.accepted_at).toISOString(),
              acceptance_method: 'explicit_in_app', evidence_type: 'electronic_acceptance_record' })],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
           VALUES ($1, 'account.persona_verification_consent_accepted', 'user', $1, $2::jsonb)`,
          [userId, JSON.stringify({ agreement_key: PERSONA_AGREEMENT_KEY, agreement_version: PERSONA_AGREEMENT_VERSION,
            agreement_sha256: agreementSha256, acceptance_id: acceptance.id, vault_pdf_sha256: pdfSha256 })],
        );
      }
      await client.query('COMMIT');
      return { accepted: true, version: PERSONA_AGREEMENT_VERSION };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Get('status')
  async status(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT status, updated_at FROM persona_user_inquiries
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]);
    const row = result.rows[0] || null;
    return { status: row?.status || 'not_started', verified: row?.status === 'approved', updatedAt: row?.updated_at || null };
  }

  @Post('inquiry')
  @HttpCode(200)
  async createInquiry(@Req() request: Request) {
    let diagnosticStage = 'session';
    let upstreamStatus: number | null = null;
    let upstreamErrorCount = 0;
    try {
    const userId = await this.currentUser(request);
    const consent = await databasePool!.query(
      'SELECT 1 FROM persona_verification_agreement_acceptances WHERE user_id = $1 AND agreement_key = $2 AND agreement_version = $3 AND agreement_sha256 = $4 LIMIT 1',
      [userId, PERSONA_AGREEMENT_KEY, PERSONA_AGREEMENT_VERSION, createHash('sha256').update(PERSONA_AGREEMENT_CONTENT, 'utf8').digest('hex')],
    );
    if (!consent.rowCount) throw new HttpException('Review and accept the identity verification consent before starting Persona verification.', HttpStatus.PRECONDITION_REQUIRED);
    const apiKey = process.env.PERSONA_API_KEY || '';
    const templateId = process.env.PERSONA_INQUIRY_TEMPLATE_ID || '';
    if (!apiKey || !/^itmpl_[A-Za-z0-9]+$/.test(templateId)) {
      throw new HttpException('Identity verification is being configured. Please try again shortly.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const redirectUri = process.env.PERSONA_REDIRECT_URI || 'https://trademate.cfd/';
    let redirectTarget: URL;
    try { redirectTarget = new URL(redirectUri); } catch {
      throw new HttpException('Persona return address is not configured correctly.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (redirectTarget.protocol !== 'https:' || !['trademate.cfd', 'www.trademate.cfd'].includes(redirectTarget.hostname)) {
      throw new HttpException('Persona return address must use the TradeMate HTTPS domain.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    diagnosticStage = 'lookup_existing_inquiry';
    const existing = await databasePool!.query(
      `SELECT inquiry_id, status FROM persona_user_inquiries
       WHERE user_id = $1 AND status IN ('pending','in_progress','submitted','review')
       ORDER BY created_at DESC LIMIT 1`, [userId]);
    let inquiryId = existing.rows[0]?.inquiry_id as string | undefined;
    let hostedUrl = '';
    if (inquiryId) {
      diagnosticStage = 'generate_existing_inquiry_link';
      upstreamStatus = null;
      const linkResponse = await fetch('https://api.withpersona.com/api/v1/inquiries/' + encodeURIComponent(inquiryId) + '/generate-one-time-link', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Persona-Version': '2026-09-29', Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      upstreamStatus = linkResponse.status;
      if (!linkResponse.ok) {
        if ([404, 409, 422].includes(linkResponse.status)) {
          inquiryId = undefined;
        } else {
          throw new HttpException('Persona could not create a secure verification link. Please try again.', HttpStatus.BAD_GATEWAY);
        }
      } else {
        const linkPayload: unknown = await linkResponse.json();
        const linkMeta = isRecord(linkPayload) && isRecord(linkPayload.meta) ? linkPayload.meta : null;
        const oneTimeLink = linkMeta && typeof linkMeta['one-time-link'] === 'string' ? linkMeta['one-time-link'] : '';
        if (!oneTimeLink) throw new HttpException('Persona did not return a secure one-time link.', HttpStatus.BAD_GATEWAY);
        const parsed = parsePersonaHostedLink(oneTimeLink);
        parsed.searchParams.set('redirect-uri', redirectTarget.toString());
        hostedUrl = parsed.toString();
      }
    }
    if (!inquiryId) {
      diagnosticStage = 'create_persona_inquiry';
      upstreamStatus = null;
      const created = await fetch('https://api.withpersona.com/api/v1/inquiries', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Persona-Version': '2026-09-29', 'Content-Type': 'application/json', Accept: 'application/json',
          'Idempotency-Key': 'trademate-identity-' + userId + '-' + randomBytes(12).toString('hex') },
        body: JSON.stringify({ data: { attributes: { 'inquiry-template-id': templateId, 'reference-id': userId } } }),
        signal: AbortSignal.timeout(15000),
      });
      upstreamStatus = created.status;
      if (!created.ok) {
        // Never log raw upstream response fields; they may contain user data.
        const errorPayload: unknown = await created.json().catch(() => null);
        const errors = isRecord(errorPayload) && Array.isArray(errorPayload.errors) ? errorPayload.errors : [];
        upstreamErrorCount = errors.length;
        throw new HttpException('Persona could not start verification. Please try again later.', created.status === 401 || created.status === 403 ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.BAD_GATEWAY);
      }
      const payload: unknown = await created.json();
      const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
      inquiryId = data && typeof data.id === 'string' ? data.id : undefined;
      if (!inquiryId || !/^inq_[A-Za-z0-9]+$/.test(inquiryId)) throw new HttpException('Persona returned an invalid inquiry reference.', HttpStatus.BAD_GATEWAY);
      const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : null;
      let oneTimeLink = meta && typeof meta['one-time-link'] === 'string' ? meta['one-time-link'] : '';
      if (!oneTimeLink) {
        diagnosticStage = 'generate_new_inquiry_link';
        upstreamStatus = null;
        const linkResponse = await fetch('https://api.withpersona.com/api/v1/inquiries/' + encodeURIComponent(inquiryId) + '/generate-one-time-link', {
          method: 'POST', headers: { Authorization: 'Bearer ' + apiKey, 'Persona-Version': '2026-09-29', Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        upstreamStatus = linkResponse.status;
        if (!linkResponse.ok) throw new HttpException('Persona created the inquiry but could not generate a secure access link.', HttpStatus.BAD_GATEWAY);
        const linkPayload: unknown = await linkResponse.json();
        const linkMeta = isRecord(linkPayload) && isRecord(linkPayload.meta) ? linkPayload.meta : null;
        oneTimeLink = linkMeta && typeof linkMeta['one-time-link'] === 'string' ? linkMeta['one-time-link'] : '';
      }
      if (!oneTimeLink) throw new HttpException('Persona did not return a secure verification link.', HttpStatus.BAD_GATEWAY);
      const parsed = parsePersonaHostedLink(oneTimeLink);
      parsed.searchParams.set('redirect-uri', redirectTarget.toString());
      hostedUrl = parsed.toString();
      diagnosticStage = 'persist_persona_inquiry';
      await databasePool!.query(
        `INSERT INTO persona_user_inquiries (user_id, inquiry_id, status)
         VALUES ($1, $2, 'pending') ON CONFLICT (inquiry_id) DO NOTHING`, [userId, inquiryId]);
      // A webhook can arrive before the API request has stored the inquiry mapping.
      // Reconcile the most recent signed event after inserting the mapping.
      diagnosticStage = 'reconcile_persona_webhook';
      await databasePool!.query(
        `UPDATE persona_user_inquiries AS inquiry
         SET status = CASE event.event_name
           WHEN 'inquiry.created' THEN 'pending'
           WHEN 'inquiry.started' THEN 'in_progress'
           WHEN 'inquiry.completed' THEN 'submitted'
           WHEN 'inquiry.approved' THEN 'approved'
           WHEN 'inquiry.declined' THEN 'declined'
           WHEN 'inquiry.marked-for-review' THEN 'review'
           WHEN 'inquiry.failed' THEN 'failed'
           WHEN 'inquiry.expired' THEN 'expired'
           ELSE inquiry.status
         END,
         updated_at = now(),
         approved_at = CASE WHEN event.event_name = 'inquiry.approved'
           THEN COALESCE(inquiry.approved_at, event.event_created_at, now())
           ELSE inquiry.approved_at END
         FROM (
           SELECT event_name, event_created_at
           FROM persona_webhook_events
           WHERE inquiry_id = $1
           ORDER BY event_created_at DESC NULLS LAST, received_at DESC
           LIMIT 1
         ) AS event
         WHERE inquiry.inquiry_id = $1
           AND (inquiry.status <> 'approved' OR event.event_name = 'inquiry.approved')`,
        [inquiryId]);
      await savePersonaVerificationEventEvidence(inquiryId);
    }
    return { inquiryId, url: hostedUrl, status: 'pending' };
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500;
      const reason = error instanceof HttpException
        ? error.message
        : error instanceof Error ? error.name : 'UnknownError';
      console.error('[persona] inquiry request failed', {
        stage: diagnosticStage,
        status,
        upstreamStatus,
        upstreamErrorCount,
        reason: String(reason).slice(0, 160),
      });
      throw error;
    }
  }
}

@Controller('auth')
class AuthController {
  @Post('register')
  async register(@Body() body: { email?: string; password?: string; displayName?: string }, @Req() request: Request) {
    parseBody(registerBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address.');
    if (displayName.length < 2 || displayName.length > 80) throw new BadRequestException('Your name must be between 2 and 80 characters.');
    if (password.length < 12 || password.length > 128) throw new BadRequestException('Use a password between 12 and 128 characters.');
    // Registration performs an expensive scrypt operation; limit attempts before hashing
    // so unauthenticated clients cannot exhaust API CPU by repeatedly creating accounts.
    const registrationRateKey = tokenDigest((request.ip || 'unknown') + '|register');
    const registrationRate = await databasePool.query(
      "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= 6 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
      [registrationRateKey],
    );
    if (registrationRate.rows[0].attempts > 5 || (registrationRate.rows[0].blocked_until && new Date(registrationRate.rows[0].blocked_until).getTime() > Date.now())) {
      throw new HttpException('Too many registration attempts. Please wait 15 minutes before trying again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const hash = await passwordHash(password);
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      const registered = await client.query(
        'SELECT trademate_private.register_password_account($1, $2, $3, $4) AS user_id',
        [email, displayName, hash, tokenDigest(code)],
      );
      const userId = String(registered.rows[0].user_id);
      const registrationAt = new Date();
      const registrationPdf = buildAccountRegistrationRecordPdf({
        id: userId, email, display_name: displayName, status: 'pending email verification',
      }, registrationAt);
      const registrationHash = createHash('sha256').update(registrationPdf).digest('hex');
      await client.query(
        'INSERT INTO user_documents (owner_user_id, source_type, source_id, document_type, document_status, visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata) VALUES ($1, \'account\', $1, \'other\', \'generated\', \'private\', $2, \'application/pdf\', $3, $4, $5, $6::jsonb)',
        [userId, 'TradeMate-Account-Registration-' + registrationAt.toISOString().slice(0, 10) + '.pdf',
          registrationPdf.length, registrationHash, registrationPdf,
          JSON.stringify({ record_type: 'account_registration_event', account_status: 'pending_email_verification', email_verification_completed: false, recorded_at: registrationAt.toISOString() })],
      );
      await client.query('COMMIT');
      const delivered = await sendTransactionalEmail(email, 'Verify your TradeMate email', '<p>Your TradeMate verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">' + code + '</p><p>This code expires in 10 minutes and can only be used once.</p>');
      if (!delivered) throw new HttpException('Your account was created, but the verification email could not be sent. Use Resend to try again.', HttpStatus.SERVICE_UNAVAILABLE);
      return { requiresEmailVerification: true, email, expiresInSeconds: 600 };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('An account with this email already exists.');
      throw error;
    } finally { client.release(); }
  }

  @Post('email-verification/resend')
  @HttpCode(200)
  async resendEmailVerification(@Body() body: { email?: string }, @Req() request: Request) {
    parseBody(passwordResetRequestBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const email = String(body?.email || '').trim().toLowerCase();
    const ip = request.ip || 'unknown';
    for (const item of [
      { key: tokenDigest(ip + '|email-verify-ip'), limit: 10 },
      { key: tokenDigest(ip + '|email-verify|' + tokenDigest(email)), limit: 3 },
    ]) {
      const rate = await databasePool.query(
        "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= $2 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
        [item.key, item.limit],
      );
      if (rate.rows[0].attempts > item.limit || (rate.rows[0].blocked_until && new Date(rate.rows[0].blocked_until).getTime() > Date.now())) throw new HttpException('Too many verification requests. Please wait 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const issued = await databasePool.query(
      'SELECT delivery_email FROM trademate_private.resend_email_verification_code($1, $2)',
      [email, tokenDigest(code)],
    );
    // Keep the response generic even when no pending account exists or delivery fails.
    if (issued.rowCount) {
      await sendTransactionalEmail(issued.rows[0].delivery_email, 'Your TradeMate verification code', '<p>Your TradeMate verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">' + code + '</p><p>This code expires in 10 minutes and can only be used once.</p>');
    }
    return { success: true, message: 'If this account is awaiting verification, a new code has been sent.' };
  }

  @Post('email-verification/confirm')
  @HttpCode(200)
  async confirmEmailVerification(@Body() body: { email?: string; code?: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    parseBody(emailVerificationBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '');
    const sessionToken = randomBytes(32).toString('base64url');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const verified = await client.query(
        'SELECT verified_user_id AS id, verified_email AS email, verified_display_name AS display_name, verified_country_code AS country_code FROM trademate_private.complete_email_verification($1, $2, $3, $4, $5, $6)',
        [
          email,
          tokenDigest(code),
          tokenDigest(sessionToken),
          new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
          request.ip || null,
          request.get('user-agent')?.slice(0, 500) || null,
        ],
      );
      if (!verified.rowCount) {
        // The function records failed attempts; commit that counter before rejecting the request.
        await client.query('COMMIT');
        throw new UnauthorizedException('This verification code is invalid or expired. Request a new one.');
      }
      const verifiedUser = verified.rows[0] as Record<string, unknown>;
      const verifiedAt = new Date();
      const verificationPdf = buildEmailVerificationRecordPdf(verifiedUser, verifiedAt);
      const verificationHash = createHash('sha256').update(verificationPdf).digest('hex');
      await client.query(
        'INSERT INTO user_documents (owner_user_id, source_type, source_id, document_type, document_status, visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata) VALUES ($1, \'email_verification\', NULL, \'other\', \'generated\', \'private\', $2, \'application/pdf\', $3, $4, $5, $6::jsonb)',
        [String(verifiedUser.id), 'TradeMate-Email-Verification-' + verifiedAt.toISOString().slice(0, 10) + '.pdf', verificationPdf.length, verificationHash, verificationPdf, JSON.stringify({ record_type: 'email_verification_event', verified_email: String(verifiedUser.email || ''), verified_at: verifiedAt.toISOString(), verification_scope: 'email_address_only' })],
      );
      await client.query('COMMIT');
      response.cookie(SESSION_COOKIE, sessionToken, cookieOptions());
      return { user: verifiedUser };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email?: string; password?: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    parseBody(loginBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password || email.length > 254 || password.length > 128) throw new UnauthorizedException('Email or password is incorrect.');
    const rateKey = tokenDigest((request.ip || 'unknown') + '|' + email);
    const rate = await databasePool.query(
      "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= 10 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
      [rateKey],
    );
    if (rate.rows[0].attempts > 10 || (rate.rows[0].blocked_until && new Date(rate.rows[0].blocked_until).getTime() > Date.now())) {
      throw new HttpException('Too many sign-in attempts. Please wait 15 minutes before trying again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const result = await databasePool.query(
      'SELECT user_id AS id, email, display_name, country_code, account_status AS status, email_verified_at, password_hash FROM trademate_private.resolve_password_login_credentials($1)',
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await passwordMatches(password, user.password_hash))) throw new UnauthorizedException('Email or password is incorrect.');
    if (!user.email_verified_at) throw new ForbiddenException('Verify your email address before signing in. Use Resend to receive a new code.');
    if (user.status !== 'active') throw new UnauthorizedException('Email or password is incorrect.');
    const security = await databasePool.query('SELECT totp_enabled FROM user_auth_security WHERE user_id = $1 LIMIT 1', [user.id]);
    if (security.rows[0]?.totp_enabled) {
      const challengeToken = randomBytes(32).toString('base64url');
      const challengeIssued = await databasePool.query(
        'SELECT trademate_private.issue_totp_login_challenge($1, $2) AS issued',
        [user.id, tokenDigest(challengeToken)],
      );
      if (!challengeIssued.rows[0]?.issued) {
        throw new UnauthorizedException('Email or password is incorrect.');
      }
      // Keep the password-stage rate limit until the second factor succeeds.
      return { requiresTwoFactor: true, challengeToken, expiresInSeconds: 300 };
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const issuedSession = await databasePool.query(
      'SELECT trademate_private.issue_password_login_session($1, $2, $3, $4, $5, $6) AS session_id',
      [
        user.id,
        user.password_hash,
        tokenDigest(token),
        expiresAt,
        request.ip || null,
        request.get('user-agent')?.slice(0, 500) || null,
      ],
    );
    if (!issuedSession.rows[0]?.session_id) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    await databasePool.query('DELETE FROM auth_rate_limits WHERE key_hash = $1', [rateKey]);
    await notifySuccessfulSignIn(user.email);
    response.cookie(SESSION_COOKIE, token, cookieOptions());
    return { user: { id: user.id, email: user.email, display_name: user.display_name, country_code: user.country_code } };
  }

  @Get('agreement/status')
  async agreementStatus(@Req() request: Request) {
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const accepted = await databasePool.query(
      'SELECT 1 FROM user_agreement_acceptances WHERE user_id = $1 AND agreement_key = $2 AND agreement_version = $3 LIMIT 1',
      [session.rows[0].id, PLATFORM_AGREEMENT_KEY, PLATFORM_AGREEMENT_VERSION],
    );
    return {
      required: accepted.rowCount === 0,
      agreement: { key: PLATFORM_AGREEMENT_KEY, version: PLATFORM_AGREEMENT_VERSION, sha256: createHash('sha256').update(PLATFORM_AGREEMENT_CONTENT, 'utf8').digest('hex'), title: 'TradeMate Platform User Agreement', content: PLATFORM_AGREEMENT_CONTENT },
    };
  }

  @Post('agreement/accept')
  @HttpCode(200)
  async acceptAgreement(@Req() request: Request, @Body() body: { version?: string; accepted?: boolean }) {
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    if (body?.accepted !== true || body?.version !== PLATFORM_AGREEMENT_VERSION) {
      throw new BadRequestException('Review the current agreement and explicitly accept its version to continue.');
    }
    const userId = session.rows[0].id as string;
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const agreementSha256 = createHash('sha256').update(PLATFORM_AGREEMENT_CONTENT, 'utf8').digest('hex');
      const accepted = await client.query(
        `INSERT INTO user_agreement_acceptances
          (user_id, agreement_key, agreement_version, agreement_sha256, acceptance_method, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, 'explicit_in_app', $5, $6)
         ON CONFLICT (user_id, agreement_key, agreement_version) DO NOTHING
         RETURNING id, accepted_at`,
        [userId, PLATFORM_AGREEMENT_KEY, PLATFORM_AGREEMENT_VERSION, agreementSha256,
         request.ip || null, request.get('user-agent')?.slice(0, 500) || null],
      );
      if (accepted.rowCount) {
        const acceptance = accepted.rows[0];
        const pdf = buildAgreementAcceptancePdf(PLATFORM_AGREEMENT_KEY, PLATFORM_AGREEMENT_VERSION, 'TradeMate Platform User Agreement', PLATFORM_AGREEMENT_CONTENT, new Date(acceptance.accepted_at), acceptance.id, userId, agreementSha256);
        const pdfSha256 = createHash('sha256').update(pdf).digest('hex');
        await client.query(
          `INSERT INTO user_documents
            (owner_user_id, source_type, source_id, document_type, document_status, visibility,
             file_name, mime_type, file_size, file_sha256, file_data, metadata)
           VALUES ($1, 'account', $2, 'agreement', 'generated', 'private',
                   'TradeMate-Platform-User-Agreement-v1.0.pdf', 'application/pdf',
                   $3, $4, $5, $6::jsonb)`,
          [userId, acceptance.id, pdf.length, pdfSha256, pdf,
           JSON.stringify({ agreement_key: PLATFORM_AGREEMENT_KEY, agreement_version: PLATFORM_AGREEMENT_VERSION,
             agreement_sha256: agreementSha256, acceptance_id: acceptance.id, accepted_at: new Date(acceptance.accepted_at).toISOString(),
             acceptance_method: 'explicit_in_app', evidence_type: 'electronic_acceptance_record' })],
        );
        await client.query(
          `INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
           VALUES ($1, 'account.platform_agreement_accepted', 'user', $1, $2::jsonb)`,
          [userId, JSON.stringify({ agreement_key: PLATFORM_AGREEMENT_KEY, agreement_version: PLATFORM_AGREEMENT_VERSION,
            agreement_sha256: agreementSha256, acceptance_id: acceptance.id, vault_pdf_sha256: pdfSha256 })],
        );
      }
      await client.query('COMMIT');
      return { accepted: true, version: PLATFORM_AGREEMENT_VERSION };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('me')
  async me(@Req() request: Request) {
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    await databasePool.query('SELECT touched_user_id FROM trademate_private.touch_presented_session($1)', [tokenDigest(token)]);
    const result = await databasePool.query(
      'SELECT id, email, display_name, country_code FROM users WHERE id = $1 AND status = \'active\' LIMIT 1',
      [session.rows[0].id],
    );
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return { user: result.rows[0] };
  }

  @Patch('profile')
  async updateProfile(@Req() request: Request, @Body() body: { displayName?: string }) {
    parseBody(displayNameBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to update your profile.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    if (displayName.length < 2 || displayName.length > 24) throw new BadRequestException('Your nickname must be between 2 and 24 characters.');
    const userId = session.rows[0].id as string;
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        'UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2 RETURNING id, email, display_name, country_code',
        [displayName, userId],
      );
      if (!updated.rowCount) throw new NotFoundException('User profile not found.');
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'profile.display_name_updated', 'user', $1, '{}'::jsonb)",
        [userId],
      );
      await client.query('COMMIT');
      return { user: updated.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Req() request: Request,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    parseBody(changePasswordBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to change your password.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || currentPassword.length > 128) throw new BadRequestException('Enter your current password.');
    if (newPassword.length < 12 || newPassword.length > 128) throw new BadRequestException('Use a new password between 12 and 128 characters.');
    if (currentPassword === newPassword) throw new BadRequestException('Choose a password you have not used for this change.');
    const credentials = await databasePool.query(
      'SELECT password_hash FROM trademate_private.resolve_presented_password_credentials($1)',
      [tokenDigest(token)],
    );
    if (!credentials.rowCount || !(await passwordMatches(currentPassword, credentials.rows[0].password_hash))) {
      throw new UnauthorizedException('Your current password is incorrect.');
    }
    const nextHash = await passwordHash(newPassword);
    // The credential write, other-session revocation and audit event happen atomically in one scoped
    // database operation. It compares against the hash verified above, so a concurrent change fails closed.
    const changed = await databasePool.query(
      'SELECT changed_email FROM trademate_private.change_presented_password($1, $2, $3)',
      [tokenDigest(token), credentials.rows[0].password_hash, nextHash],
    );
    if (!changed.rowCount) throw new UnauthorizedException('Your session or password changed. Please sign in again.');
    if (changed.rows[0].changed_email) void sendTransactionalEmail(changed.rows[0].changed_email, 'Your TradeMate password was changed', '<p>Your TradeMate password was changed successfully.</p><p>If you did not make this change, contact TradeMate support immediately.</p>');
    return { success: true, message: 'Password updated. Other active sessions have been signed out.' };
  }


  @Post('password-reset/request')
  @HttpCode(200)
  async requestPasswordReset(@Body() body: { email?: string }, @Req() request: Request) {
    parseBody(passwordResetRequestBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const email = String(body?.email || '').trim().toLowerCase();
    const ip = request.ip || 'unknown';
    const rateKeys = [
      { key: tokenDigest(ip + '|password-reset-ip'), limit: 10 },
      { key: tokenDigest(ip + '|password-reset-email|' + tokenDigest(email)), limit: 3 },
    ];
    for (const rateKey of rateKeys) {
      const rate = await databasePool.query(
        "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= $2 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
        [rateKey.key, rateKey.limit],
      );
      if (rate.rows[0].attempts > rateKey.limit || (rate.rows[0].blocked_until && new Date(rate.rows[0].blocked_until).getTime() > Date.now())) {
        throw new HttpException('Too many password reset requests. Please wait 15 minutes before trying again.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    const webOrigin = process.env.TRADEMATE_WEB_ORIGIN || process.env.PUBLIC_APP_URL || (process.env.WEB_ORIGIN || '').split(',')[0].trim();
    let resetOrigin = '';
    try {
      const parsed = new URL(webOrigin);
      if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && process.env.NODE_ENV !== 'production')) resetOrigin = parsed.origin;
    } catch { resetOrigin = ''; }
    if (resetOrigin) {
      const rawToken = randomBytes(32).toString('base64url');
      const issued = await databasePool.query(
        'SELECT delivery_email FROM trademate_private.issue_password_reset($1, $2)',
        [email, tokenDigest(rawToken)],
      );
      if (issued.rowCount) {
        const resetUrl = resetOrigin + '/app#passwordReset=' + encodeURIComponent(rawToken);
        void sendTransactionalEmail(
          issued.rows[0].delivery_email,
          'Reset your TradeMate password',
          '<p>We received a request to reset your TradeMate password.</p><p><a href="' + resetUrl + '" style="display:inline-block;padding:13px 22px;background-color:#F6A43A;color:#17120b;text-decoration:none;font-weight:800;border-radius:9px;">Reset your password</a></p><p>This link expires in 30 minutes and can be used once. If you did not request this, you can ignore this email.</p>',
        ).then((sent) => sent ? undefined : databasePool?.query('SELECT trademate_private.discard_password_reset_token($1)', [tokenDigest(rawToken)]).catch(() => undefined));
      }
    }
    return { success: true, message: 'If an active account exists for that email, a password reset link will be sent.' };
  }

  @Post('password-reset/complete')
  @HttpCode(200)
  async completePasswordReset(@Body() body: { token?: string; newPassword?: string }, @Req() request: Request) {
    parseBody(passwordResetCompleteBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const rawToken = String(body?.token || '');
    const newPassword = String(body?.newPassword || '');
    const resetRateKey = tokenDigest((request.ip || 'unknown') + '|password-reset-complete|' + tokenDigest(rawToken));
    const rate = await databasePool.query(
      "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= 5 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
      [resetRateKey],
    );
    if (rate.rows[0].attempts > 5 || (rate.rows[0].blocked_until && new Date(rate.rows[0].blocked_until).getTime() > Date.now())) {
      throw new HttpException('Too many password reset attempts. Please request a new link later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const nextHash = await passwordHash(newPassword);
    const reset = await databasePool.query(
      'SELECT reset_user_id::text AS user_id, reset_email AS email FROM trademate_private.complete_password_reset($1, $2)',
      [tokenDigest(rawToken), nextHash],
    );
    if (!reset.rowCount) throw new BadRequestException('This password reset link is invalid, expired, or already used.');
    const email = reset.rows[0].email as string;
    if (email) void sendTransactionalEmail(email, 'Your TradeMate password was reset', '<p>Your TradeMate password was reset successfully. All existing sessions have been signed out.</p><p>If you did not make this change, contact TradeMate support immediately.</p>');
    return { success: true, message: 'Your password has been reset. Sign in again with your new password.' };
  }

  @Get('2fa/status')
  async twoFactorStatus(@Req() request: Request) {
    const token = sessionTokenFrom(request);
    if (!token || !databasePool) throw new UnauthorizedException('Please sign in.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired.');
    const result = await databasePool.query('SELECT totp_enabled, totp_confirmed_at FROM user_auth_security WHERE user_id=$1', [session.rows[0].id]);
    return { enabled: Boolean(result.rows[0]?.totp_enabled), confirmedAt: result.rows[0]?.totp_confirmed_at || null, available: /^[0-9a-f]{64}$/i.test(process.env.TOTP_ENCRYPTION_KEY || '') };
  }

  @Post('2fa/setup')
  async setupTwoFactor(@Req() request: Request) {
    const token = sessionTokenFrom(request);
    if (!token || !databasePool) throw new UnauthorizedException('Please sign in.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired.');
    const account = await databasePool.query('SELECT email FROM users WHERE id = $1 AND status = \'active\' LIMIT 1', [session.rows[0].id]);
    if (!account.rowCount) throw new UnauthorizedException('Your session has expired.');
    const encryptionKey = process.env.TOTP_ENCRYPTION_KEY || '';
    if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) throw new HttpException('Authenticator setup is not available until the server encryption key is configured.', HttpStatus.SERVICE_UNAVAILABLE);
    const secret = base32Encode(randomBytes(20));
    const enrollment = await databasePool.query(
      'SELECT trademate_private.begin_totp_enrollment($1, $2) AS started',
      [tokenDigest(token), encryptTotpSecret(secret)],
    );
    if (!enrollment.rows[0]?.started) throw new ConflictException('Two-factor authentication is already enabled or setup is unavailable.');
    const label = encodeURIComponent('TradeMate:' + account.rows[0].email);
    const issuer = encodeURIComponent('TradeMate');
    return { secret, otpauthUrl: 'otpauth://totp/' + label + '?secret=' + secret + '&issuer=' + issuer + '&algorithm=SHA1&digits=6&period=30', expiresInSeconds: 900 };
  }

  @Post('2fa/confirm')
  async confirmTwoFactor(@Req() request: Request, @Body() body: { code?: string }) {
    parseBody(totpCodeBodySchema, body);
    const token = sessionTokenFrom(request);
    if (!token || !databasePool) throw new UnauthorizedException('Please sign in.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired.');
    const userId = session.rows[0].id;
    const rateKey = await enforceTotpRateLimit(request, userId);
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT encrypted_totp_secret, enrollment_expires_at, last_totp_counter FROM trademate_private.resolve_totp_enrollment($1)',
        [tokenDigest(token)],
      );
      if (!result.rowCount || !result.rows[0].enrollment_expires_at || new Date(result.rows[0].enrollment_expires_at).getTime() < Date.now()) {
        throw new ConflictException('Start authenticator setup again; the setup has expired.');
      }
      let matchedCounter: number | null = null;
      try { matchedCounter = verifyTotp(decryptTotpSecret(result.rows[0].encrypted_totp_secret), String(body?.code || '')); } catch { matchedCounter = null; }
      const lastCounter = result.rows[0].last_totp_counter == null ? null : BigInt(result.rows[0].last_totp_counter);
      if (matchedCounter === null || (lastCounter !== null && BigInt(matchedCounter) <= lastCounter)) {
        throw new UnauthorizedException('That authenticator code is invalid or has already been used.');
      }
      const completed = await client.query(
        'SELECT trademate_private.complete_totp_enrollment($1, $2) AS completed',
        [tokenDigest(token), matchedCounter],
      );
      if (!completed.rows[0]?.completed) throw new UnauthorizedException('That authenticator code has already been used. Generate a new code and try again.');
      await client.query('DELETE FROM auth_rate_limits WHERE key_hash=$1', [rateKey]);
      await client.query('COMMIT');
      return { success: true, enabled: true };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('2fa/disable')
  async disableTwoFactor(@Req() request: Request, @Body() body: { code?: string }) {
    parseBody(totpCodeBodySchema, body);
    const token = sessionTokenFrom(request);
    if (!token || !databasePool) throw new UnauthorizedException('Please sign in.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired.');
    const userId = session.rows[0].id;
    const rateKey = await enforceTotpRateLimit(request, userId);
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT encrypted_totp_secret, last_totp_counter FROM trademate_private.resolve_enabled_totp($1)',
        [tokenDigest(token)],
      );
      if (!result.rowCount) throw new ConflictException('Two-factor authentication is not enabled.');
      let matchedCounter: number | null = null;
      try { matchedCounter = verifyTotp(decryptTotpSecret(result.rows[0].encrypted_totp_secret), String(body?.code || '')); } catch { matchedCounter = null; }
      const lastCounter = result.rows[0].last_totp_counter == null ? null : BigInt(result.rows[0].last_totp_counter);
      if (matchedCounter === null || (lastCounter !== null && BigInt(matchedCounter) <= lastCounter)) {
        throw new UnauthorizedException('That authenticator code is invalid or has already been used.');
      }
      const disabled = await client.query(
        'SELECT trademate_private.disable_totp($1, $2) AS disabled',
        [tokenDigest(token), matchedCounter],
      );
      if (!disabled.rows[0]?.disabled) throw new UnauthorizedException('That authenticator code has already been used. Generate a new code and try again.');
      await client.query('DELETE FROM auth_rate_limits WHERE key_hash=$1', [rateKey]);
      await client.query('COMMIT');
      return { success: true, enabled: false };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('2fa/verify')
  @HttpCode(200)
  async verifyTwoFactor(@Body() body: { challengeToken?: string; code?: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    parseBody(totpChallengeBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const challengeToken = typeof body?.challengeToken === 'string' ? body.challengeToken : '';
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!challengeToken || challengeToken.length > 128 || !/^\d{6}$/.test(code)) throw new UnauthorizedException('Enter the six-digit authenticator code.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const challengeHash = tokenDigest(challengeToken);
      const challenge = await client.query(
        'SELECT challenge_user_id AS user_id, challenge_attempts AS attempts, challenge_email AS email, challenge_display_name AS display_name, challenge_country_code AS country_code, encrypted_totp_secret, last_totp_counter FROM trademate_private.resolve_totp_login_challenge($1)',
        [challengeHash],
      );
      if (!challenge.rowCount) throw new UnauthorizedException('This verification attempt has expired. Sign in again.');
      const totpRateKey = tokenDigest((request.ip || 'unknown') + '|totp|' + challenge.rows[0].user_id);
      const totpRate = await client.query(
        "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= 10 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
        [totpRateKey],
      );
      if (totpRate.rows[0].attempts > 10 || (totpRate.rows[0].blocked_until && new Date(totpRate.rows[0].blocked_until).getTime() > Date.now())) {
        await client.query('COMMIT');
        throw new HttpException('Too many authenticator attempts. Please wait 15 minutes before trying again.', HttpStatus.TOO_MANY_REQUESTS);
      }
      let matchedCounter: number | null = null;
      try {
        matchedCounter = verifyTotp(decryptTotpSecret(challenge.rows[0].encrypted_totp_secret), code);
      } catch { matchedCounter = null; }
      const lastCounter = challenge.rows[0].last_totp_counter == null ? null : BigInt(challenge.rows[0].last_totp_counter);
      if (matchedCounter === null || (lastCounter !== null && BigInt(matchedCounter) <= lastCounter)) {
        await client.query('SELECT trademate_private.record_totp_login_failure($1)', [challengeHash]);
        await client.query('COMMIT');
        throw new UnauthorizedException('The authenticator code is incorrect or has already been used.');
      }
      const sessionToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      const completedLogin = await client.query(
        'SELECT verified_user_id AS id, verified_email AS email, verified_display_name AS display_name, verified_country_code AS country_code FROM trademate_private.complete_totp_login($1, $2, $3, $4, $5, $6)',
        [
          tokenDigest(challengeToken),
          matchedCounter,
          tokenDigest(sessionToken),
          expiresAt,
          request.ip || null,
          request.get('user-agent')?.slice(0, 500) || null,
        ],
      );
      if (!completedLogin.rowCount) {
        await client.query('SELECT trademate_private.record_totp_login_failure($1)', [challengeHash]);
        await client.query('COMMIT');
        throw new UnauthorizedException('The authenticator code is incorrect or has already been used.');
      }
      await client.query('DELETE FROM auth_rate_limits WHERE key_hash IN ($1, $2)', [totpRateKey, tokenDigest((request.ip || 'unknown') + '|' + String(challenge.rows[0].email).trim().toLowerCase())]);
      await client.query('COMMIT');
      await notifySuccessfulSignIn(completedLogin.rows[0].email);
      response.cookie(SESSION_COOKIE, sessionToken, cookieOptions());
      return { user: completedLogin.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Get('sessions')
  async listSessions(@Req() request: Request) {
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to review your sessions.');
    const digest = tokenDigest(token);
    const current = await resolvePresentedSessionUserDigest(digest);
    if (!current.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    await databasePool.query('SELECT touched_user_id FROM trademate_private.touch_presented_session($1)', [digest]);
    const result = await databasePool.query(
      'SELECT session_id AS id, created_at, last_seen_at, expires_at, ip_address, user_agent, is_current FROM trademate_private.list_presented_user_sessions($1)',
      [digest],
    );
    return { sessions: result.rows };
  }

  @Delete('sessions/:id')
  async revokeSession(@Param('id') id: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    parseUuidParam(id);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to manage sessions.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid session identifier.');
    const digest = tokenDigest(token);
    const current = await resolvePresentedSessionUserDigest(digest);
    if (!current.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const result = await databasePool.query(
      'SELECT revoked_session_id, revoked_user_id, was_current FROM trademate_private.revoke_presented_user_session($1, $2)',
      [digest, id],
    );
    if (!result.rowCount) throw new NotFoundException('Session not found.');
    const isCurrent = Boolean(result.rows[0].was_current);
    if (isCurrent) response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' });
    return { success: true, current: isCurrent };
  }

  @Post('account-deletion/request')
  @HttpCode(200)
  async requestAccountDeletion(@Req() request: Request, @Body() body: { password?: string }, @Res({ passthrough: true }) response: Response) {
    parseBody(deletionRequestBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to request account deletion.');
    const presentedSession = await resolvePresentedSessionUser(token);
    if (!presentedSession.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const current = await databasePool.query(
      'SELECT user_id AS id, email, password_hash FROM trademate_private.resolve_presented_password_credentials($1)',
      [tokenDigest(token)],
    );
    if (!current.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    if (!current.rows[0].email) throw new ConflictException('Add an email address you can access before requesting account deletion so you can receive the cancellation code.');
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 128 || !(await passwordMatches(password, current.rows[0].password_hash))) throw new UnauthorizedException('Your password is incorrect.');
    const owner = await databasePool.query("SELECT 1 FROM organization_members WHERE user_id = $1 AND member_role = 'owner' LIMIT 1", [current.rows[0].id]);
    if (owner.rowCount) throw new ConflictException('Transfer organization ownership before requesting account deletion.');
    const cancelToken = randomBytes(32).toString('base64url');
    const requested = await databasePool.query(
      'SELECT delivery_email FROM trademate_private.request_presented_account_deletion($1, $2, $3)',
      [tokenDigest(token), current.rows[0].password_hash, tokenDigest(cancelToken)],
    );
    if (!requested.rowCount) {
      throw new UnauthorizedException('Your session or password changed. Please sign in again and retry.');
    }
    const emailSent = await sendTransactionalEmail(requested.rows[0].delivery_email, 'TradeMate account deletion requested', `<p>Your account is scheduled for deletion in 30 days.</p><p>To cancel, submit this one-time cancellation token in TradeMate account recovery:</p><p><strong>${cancelToken}</strong></p><p>Your sessions have been revoked and account access is disabled.</p>`);
    if (!emailSent) {
      const recovery = await databasePool.connect();
      try {
        await recovery.query('BEGIN');
        const rollback = await recovery.query(
          'SELECT trademate_private.rollback_account_deletion_request($1) AS restored',
          [tokenDigest(cancelToken)],
        );
        if (!rollback.rows[0]?.restored) {
          throw new Error('The pending account deletion could not be rolled back safely.');
        }
        await recovery.query('COMMIT');
      } catch (error) {
        await recovery.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally { recovery.release(); }
      throw new HttpException('We could not send your cancellation email, so the deletion request was not activated. Please try again later.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' });
    return { success: true, status: 'deletion_pending', scheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), message: 'Your account is locked and scheduled for deletion. The cancellation code has been emailed to you.' };
  }

  @Post('account-deletion/cancel')
  @HttpCode(200)
  async cancelAccountDeletion(@Body() body: { token?: string }) {
    parseBody(deletionCancelBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new BadRequestException('Enter a valid cancellation token.');
    const restored = await databasePool.query(
      'SELECT restored_user_id AS id, restored_email AS email FROM trademate_private.complete_account_deletion_cancellation($1)',
      [tokenDigest(token)],
    );
    if (!restored.rowCount) throw new NotFoundException('This cancellation token is invalid, expired, or already used.');
    if (restored.rows[0].email) void sendTransactionalEmail(restored.rows[0].email, 'TradeMate account deletion cancelled', '<p>Your TradeMate account deletion request was cancelled. Sign in to continue using your account.</p>');
    return { success: true, status: 'active', message: 'Account deletion cancelled. Sign in again to create a new session.' };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = sessionTokenFrom(request);
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' });
    if (databasePool && token) {
      await databasePool.query(
        'SELECT logged_out_user_id FROM trademate_private.logout_presented_session($1)',
        [tokenDigest(token)],
      );
    }
    return { success: true };
  }
}



@Controller('preferences')
class PreferencesController {
  private async currentUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to manage preferences.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  private defaults() {
    return { cur: 'NGN', market: 'Services', orders: true, p2p: true, promos: false, news: true, language: 'English' };
  }

  @Get()
  async getPreferences(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query('SELECT preferences FROM user_preferences WHERE user_id = $1 LIMIT 1', [userId]);
    return { preferences: { ...this.defaults(), ...(result.rows[0]?.preferences || {}) } };
  }

  @Patch()
  async updatePreferences(@Req() request: Request, @Body() body: Record<string, unknown>) {
    parseBody(preferencesBodySchema, body);
    const userId = await this.currentUser(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Send valid preference values.');
    const allowed = new Set(['cur', 'market', 'orders', 'p2p', 'promos', 'news', 'language']);
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key)) throw new BadRequestException(`Unsupported preference: ${key}.`);
      if (['orders', 'p2p', 'promos', 'news'].includes(key)) {
        if (typeof value !== 'boolean') throw new BadRequestException(`${key} must be true or false.`);
        update[key] = value;
      } else if (key === 'cur') {
        if (typeof value !== 'string' || !['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES'].includes(value)) throw new BadRequestException('Choose a supported display currency.');
        update[key] = value;
      } else if (key === 'market') {
        if (typeof value !== 'string' || !['Services', 'Real Estate', 'Software', 'B2B', 'Industrial & Trade', 'Agriculture', 'Finance & Investment', 'Institution & Infrastructure', 'Sports', 'Entertainment', 'P2P', 'NFTs', 'Forex', 'Crypto'].includes(value)) throw new BadRequestException('Choose a supported default market.');
        update[key] = value;
      } else if (key === 'language') {
        if (typeof value !== 'string' || !['English', 'Français', 'Hausa', 'Yorùbá', 'Igbo', 'Kiswahili', 'Português', 'العربية'].includes(value)) throw new BadRequestException('Choose a supported language.');
        update[key] = value;
      }
    }
    if (!Object.keys(update).length) throw new BadRequestException('No supported preferences were supplied.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO user_preferences (user_id, preferences, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (user_id) DO UPDATE SET preferences = user_preferences.preferences || EXCLUDED.preferences, updated_at = now() RETURNING preferences',
        [userId, JSON.stringify(update)],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'account.preferences_updated', 'user', $1, $2::jsonb)",
        [userId, JSON.stringify({ keys: Object.keys(update) })],
      );
      await client.query('COMMIT');
      return { preferences: { ...this.defaults(), ...result.rows[0].preferences } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

@Controller('notifications')
class NotificationsController {
  private async currentUser(request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to view notifications.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  @Get()
  async list(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      'SELECT id, category, title, body, icon, action_url, read_at, created_at FROM user_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId],
    );
    return {
      notifications: result.rows,
      unread_count: result.rows.filter((item) => !item.read_at).length,
    };
  }

  @Patch('read-all')
  async markAllRead(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      'UPDATE user_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL',
      [userId],
    );
    return { success: true, updated: result.rowCount || 0 };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid notification identifier.');
    }
    const result = await databasePool!.query(
      'UPDATE user_notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2 RETURNING id, read_at',
      [id, userId],
    );
    if (!result.rowCount) throw new NotFoundException('Notification not found.');
    return { success: true, notification: result.rows[0] };
  }
}


@Controller('support')
class SupportController {
  private async currentUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to contact support.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  private validateTicketId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid ticket identifier.');
    }
  }

  @Get('tickets')
  async tickets(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      'SELECT id, ticket_code, category, subject, status, created_at, updated_at FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100',
      [userId],
    );
    return { tickets: result.rows };
  }

  @Post('tickets')
  async createTicket(@Req() request: Request, @Body() body: { category?: string; subject?: string; message?: string }) {
    parseBody(supportTicketBodySchema, body);
    const userId = await this.currentUser(request);
    const category = typeof body?.category === 'string' ? body.category.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const categories = ['Account & security', 'Orders', 'P2P & payments', 'Listings & selling', 'Report a user or scam', 'Technical issue', 'Other'];
    if (!categories.includes(category)) throw new BadRequestException('Choose a valid support category.');
    if (subject.length < 2 || subject.length > 180) throw new BadRequestException('Your subject must be between 2 and 180 characters.');
    if (message.length < 5 || message.length > 10000) throw new BadRequestException('Your message must be between 5 and 10,000 characters.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const ticket = await client.query(
        'INSERT INTO support_tickets (user_id, category, subject) VALUES ($1,$2,$3) RETURNING id, ticket_code, category, subject, status, created_at, updated_at',
        [userId, category, subject],
      );
      await client.query(
        "INSERT INTO support_ticket_messages (ticket_id, sender_user_id, sender_type, message) VALUES ($1,$2,'user',$3)",
        [ticket.rows[0].id, userId, message],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1,'support.ticket_created','support_ticket',$2,$3::jsonb)",
        [userId, ticket.rows[0].id, JSON.stringify({ category })],
      );
      await client.query('COMMIT');
      return { ticket: ticket.rows[0], message: 'Your support ticket has been created.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('tickets/:id/messages')
  async ticketMessages(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    this.validateTicketId(id);
    const ticket = await databasePool!.query(
      'SELECT id, ticket_code, category, subject, status, created_at, updated_at FROM support_tickets WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId],
    );
    if (!ticket.rowCount) throw new NotFoundException('Support ticket not found.');
    const messages = await databasePool!.query(
      'SELECT id, sender_type, message, created_at FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at, id LIMIT 500',
      [id],
    );
    return { ticket: ticket.rows[0], messages: messages.rows };
  }

  @Post('tickets/:id/messages')
  async replyTicket(@Param('id') id: string, @Req() request: Request, @Body() body: { message?: string }) {
    parseUuidParam(id);
    parseBody(supportReplyBodySchema, body);
    const userId = await this.currentUser(request);
    this.validateTicketId(id);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > 10000) throw new BadRequestException('Your reply must be between 1 and 10,000 characters.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const ticket = await client.query(
        "SELECT id, status FROM support_tickets WHERE id = $1 AND user_id = $2 FOR UPDATE",
        [id, userId],
      );
      if (!ticket.rowCount) throw new NotFoundException('Support ticket not found.');
      if (['resolved', 'closed'].includes(ticket.rows[0].status)) throw new ConflictException('This ticket is closed. Open a new ticket if you still need help.');
      const inserted = await client.query(
        "INSERT INTO support_ticket_messages (ticket_id, sender_user_id, sender_type, message) VALUES ($1,$2,'user',$3) RETURNING id, sender_type, message, created_at",
        [id, userId, message],
      );
      await client.query("UPDATE support_tickets SET status = 'open', updated_at = now() WHERE id = $1", [id]);
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1,'support.ticket_replied','support_ticket',$2,'{}'::jsonb)",
        [userId, id],
      );
      await client.query('COMMIT');
      return { message: inserted.rows[0], success: true };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('feedback')
  async feedback(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      'SELECT id, feedback_type, message, status, created_at FROM user_feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
      [userId],
    );
    return { feedback: result.rows };
  }

  @Post('feedback')
  async submitFeedback(@Req() request: Request, @Body() body: { type?: string; message?: string }) {
    parseBody(feedbackBodySchema, body);
    const userId = await this.currentUser(request);
    const type = typeof body?.type === 'string' ? body.type.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!['Idea', 'Bug', 'Complaint', 'Praise'].includes(type)) throw new BadRequestException('Choose a valid feedback type.');
    if (message.length < 3 || message.length > 10000) throw new BadRequestException('Feedback must be between 3 and 10,000 characters.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO user_feedback (user_id, feedback_type, message) VALUES ($1,$2,$3) RETURNING id, feedback_type, message, status, created_at',
        [userId, type, message],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1,'feedback.submitted','user_feedback',$2,$3::jsonb)",
        [userId, result.rows[0].id, JSON.stringify({ type })],
      );
      await client.query('COMMIT');
      return { feedback: result.rows[0], message: 'Thank you. Your feedback has been submitted.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}


@Controller('organizations')
class OrganizationsController {
  private async currentUser(request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT o.id, o.name, o.organization_type, o.country_code, o.default_currency, o.status, om.member_role, o.created_at
       FROM organization_members om JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 ORDER BY o.created_at DESC LIMIT 1`,
      [userId],
    );
    return { organization: result.rows[0] || null };
  }

  @Post()
  async create(@Req() request: Request, @Body() body: { name?: string; organizationType?: string; countryCode?: string; defaultCurrency?: string }) {
    parseBody(organizationCreateBodySchema, body);
    const userId = await this.currentUser(request);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const organizationType = body?.organizationType;
    const countryCode = typeof body?.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';
    const defaultCurrency = typeof body?.defaultCurrency === 'string' ? body.defaultCurrency.trim().toUpperCase() : '';
    if (name.length < 2 || name.length > 120) throw new BadRequestException('Business name must be between 2 and 120 characters.');
    if (!['business', 'sole_trader', 'service_provider'].includes(organizationType || '')) {
      throw new BadRequestException('Choose a valid business type.');
    }
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new BadRequestException('Enter a valid two-letter country code.');
    if (!/^[A-Z]{3}$/.test(defaultCurrency)) throw new BadRequestException('Enter a valid three-letter currency code.');

    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [userId]);
      if (existing.rowCount) throw new ConflictException('A business space is already connected to this account.');
      const created = await client.query(
        "INSERT INTO organizations (name, organization_type, country_code, default_currency, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id, name, organization_type, country_code, default_currency, status, created_at",
        [name, organizationType, countryCode, defaultCurrency],
      );
      const organization = created.rows[0];
      await client.query(
        "INSERT INTO organization_members (organization_id, user_id, member_role) VALUES ($1, $2, 'owner')",
        [organization.id, userId],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'organization.created', 'organization', $2, $3::jsonb)",
        [userId, organization.id, JSON.stringify({ organization_type: organizationType, country_code: countryCode, default_currency: defaultCurrency })],
      );
      const registrationPdf = buildOrganizationRegistrationPdf(organization, userId);
      await client.query(
        "INSERT INTO user_documents (owner_user_id, organization_id, source_type, source_id, document_type, document_status, visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata) VALUES ($1,$2,'organization_registration',$2,'organization','generated','organization',$3,'application/pdf',$4,$5,$6,$7::jsonb)",
        [userId, organization.id, 'TradeMate-Organization-Registration-' + String(organization.id) + '.pdf',
          registrationPdf.length, createHash('sha256').update(registrationPdf).digest('hex'), registrationPdf,
          JSON.stringify({ record_type: 'organization_registration_event', organization_status: organization.status, generated_at: new Date().toISOString(), legal_registration_certificate: false })],
      );
      await client.query('COMMIT');
      return { organization: { ...organization, member_role: 'owner' } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id')
  async updateOrganization(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: { name?: string },
  ) {
    parseUuidParam(id);
    parseBody(organizationNameBodySchema, body);
    const userId = await this.currentUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid organization ID.');
    }
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 120) {
      throw new BadRequestException('Business name must be between 2 and 120 characters.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE organizations o
         SET name = $1, updated_at = now()
         WHERE o.id = $2
           AND EXISTS (
             SELECT 1 FROM organization_members om
             WHERE om.organization_id = o.id AND om.user_id = $3 AND om.member_role = 'owner'
           )
         RETURNING o.id, o.name, o.organization_type, o.country_code, o.default_currency, o.status, o.updated_at`,
        [name, id, userId],
      );
      if (!updated.rowCount) throw new NotFoundException('Business space not found or you are not its owner.');
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'organization.updated', 'organization', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ changed_fields: ['name'] })],
      );
      await client.query('COMMIT');
      return { organization: updated.rows[0], message: 'Business profile updated.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post(':id/documents')
  async uploadOrganizationDocuments(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: { files?: Array<{ fileName?: string; mimeType?: string; dataBase64?: string }> },
  ) {
    parseUuidParam(id);
    parseBody(organizationDocumentsBodySchema, body);
    const userId = await this.currentUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid organization ID.');
    const files = Array.isArray(body?.files) ? body.files : [];
    if (!files.length || files.length > 4) throw new BadRequestException('Select between 1 and 4 documents.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const member = await client.query('SELECT member_role FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
      if (!member.rowCount) throw new ForbiddenException('You do not have access to this organization.');
      if (!organizationDocumentManagerRoleSchema.safeParse(member.rows[0].member_role).success) throw new ForbiddenException('Only organization owners and admins can upload verification documents.');
      const saved: Array<Record<string, unknown>> = [];
      for (const file of files) {
        const fileName = typeof file.fileName === 'string' ? file.fileName.trim().slice(0, 180) : '';
        const mimeType = String(file.mimeType || '').toLowerCase();
        const suppliedData = String(file.dataBase64 || '');
        const dataUrl = /^data:([^;,]+);base64,(.*)$/i.exec(suppliedData);
        const encoded = dataUrl ? dataUrl[2] : suppliedData;
        if (!fileName || !['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType)
          || (suppliedData.startsWith('data:') && !dataUrl)
          || (dataUrl && dataUrl[1].toLowerCase() !== mimeType)
          || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
          throw new BadRequestException('Use valid PDF, JPG or PNG documents.');
        }
        const data = Buffer.from(encoded, 'base64');
        if (!data.length || data.length > 5 * 1024 * 1024 || data.toString('base64') !== encoded) {
          throw new BadRequestException('Each document must be valid and 5 MB or smaller.');
        }
        if (!hasMatchingUploadSignature(mimeType, data)) {
          throw new BadRequestException('The document content does not match its declared file type.');
        }
        const result = await client.query(
          "INSERT INTO organization_documents (organization_id, uploaded_by_user_id, file_name, mime_type, file_size, file_data) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, file_name, mime_type, file_size, review_status, created_at",
          [id, userId, fileName, mimeType, data.length, data],
        );
        await client.query(
          `INSERT INTO user_documents
            (owner_user_id, organization_id, source_type, source_id, document_type,
             document_status, visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata)
           VALUES ($1,$2,'organization_verification',$3,'organization','received','organization',$4,$5,$6,$7,$8,$9::jsonb)`,
          [userId, id, result.rows[0].id, fileName, mimeType, data.length,
           createHash('sha256').update(data).digest('hex'), data,
           JSON.stringify({ legacy_organization_document_id: result.rows[0].id, review_status: result.rows[0].review_status })],
        );
        saved.push(result.rows[0]);
      }
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'organization.documents_uploaded','organization',$2,$3::jsonb)",
        [userId, id, JSON.stringify({ count: saved.length })],
      );
      await client.query('COMMIT');
      return { documents: saved };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get(':id/documents')
  async organizationDocuments(@Req() request: Request, @Param('id') id: string) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    const member = await databasePool!.query('SELECT member_role FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
    if (!member.rowCount) throw new ForbiddenException('You do not have access to this organization.');
    if (!organizationDocumentManagerRoleSchema.safeParse(member.rows[0].member_role).success) throw new ForbiddenException('Only organization owners and admins can view verification documents.');
    const result = await databasePool!.query(
      'SELECT id, file_name, mime_type, file_size, review_status, created_at FROM organization_documents WHERE organization_id = $1 ORDER BY created_at DESC',
      [id],
    );
    return { documents: result.rows };
  }
}


@Controller('documents')
class UserDocumentsController {
  private async currentUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to access your documents.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session.rows[0].id as string;
  }

  private async accessibleDocument(id: string, userId: string, includeBytes = false) {
    parseUuidParam(id);
    const result = await databasePool!.query(
      `SELECT d.id, d.owner_user_id, d.organization_id, d.source_type, d.source_id,
              d.document_type, d.document_status, d.visibility, d.file_name,
              d.mime_type, d.file_size, d.file_sha256, d.metadata, d.created_at,
              ${includeBytes ? 'd.file_data' : 'NULL::bytea AS file_data'}
       FROM user_documents d
       WHERE d.id = $1 AND (
         (d.owner_user_id = $2 AND (d.source_type <> 'organization_verification' OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = d.organization_id AND om.user_id = $2 AND om.member_role IN ('owner','admin')
         )))
         OR EXISTS (SELECT 1 FROM user_document_access a WHERE a.document_id = d.id AND a.user_id = $2)
         OR (d.visibility = 'organization' AND EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = d.organization_id AND om.user_id = $2 AND (d.source_type <> 'organization_verification' OR om.member_role IN ('owner','admin'))
         ))
         OR (d.visibility = 'contract_participants' AND d.source_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM marketplace_contracts c
           WHERE c.id = d.source_id AND (
             c.buyer_user_id = $2 OR EXISTS (
               SELECT 1 FROM organization_members om
               WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2
             )
           )
         ))
       )
       LIMIT 1`,
      [id, userId],
    );
    if (!result.rowCount) throw new NotFoundException('Document not found.');
    return result.rows[0];
  }

  @Get()
  async list(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT d.id, d.owner_user_id, d.organization_id, d.source_type, d.source_id,
              d.document_type, d.document_status, d.visibility, d.file_name,
              d.mime_type, d.file_size, d.file_sha256, d.metadata, d.created_at
       FROM user_documents d
       WHERE (d.owner_user_id = $1 AND (d.source_type <> 'organization_verification' OR EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = d.organization_id AND om.user_id = $1 AND om.member_role IN ('owner','admin')
          )))
          OR EXISTS (SELECT 1 FROM user_document_access a WHERE a.document_id = d.id AND a.user_id = $1)
          OR (d.visibility = 'organization' AND EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = d.organization_id AND om.user_id = $1 AND (d.source_type <> 'organization_verification' OR om.member_role IN ('owner','admin'))
          ))
          OR (d.visibility = 'contract_participants' AND d.source_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM marketplace_contracts c
            WHERE c.id = d.source_id AND (
              c.buyer_user_id = $1 OR EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.organization_id = c.seller_organization_id AND om.user_id = $1
              )
            )
          ))
       ORDER BY d.created_at DESC LIMIT 200`,
      [userId],
    );
    return { documents: result.rows };
  }

  @Post()
  async upload(@Req() request: Request, @Body() body: {
    fileName?: string; mimeType?: string; dataBase64?: string;
    sourceType?: string; sourceId?: string; documentType?: string;
    documentStatus?: string; visibility?: string; organizationId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const userId = await this.currentUser(request);
    const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
    const mimeType = String(body?.mimeType || '').toLowerCase();
    const suppliedData = String(body?.dataBase64 || '');
    const dataUrl = /^data:([^;,]+);base64,(.*)$/i.exec(suppliedData);
    const encoded = dataUrl ? dataUrl[2] : suppliedData;
    const sourceType = String(body?.sourceType || 'user_upload');
    const documentType = String(body?.documentType || 'other');
    const documentStatus = String(body?.documentStatus || 'received');
    const visibility = String(body?.visibility || 'private');
    const sourceTypes = ['contract','contract_negotiation','user_upload'];
    const documentTypes = ['agreement','identity','address','organization','contract','statement','receipt','invoice','negotiation','other'];
    if (!fileName || fileName.length > 180
      || !['application/pdf','image/jpeg','image/png'].includes(mimeType)
      || (suppliedData.startsWith('data:') && !dataUrl)
      || (dataUrl && dataUrl[1].toLowerCase() !== mimeType)
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
      || !sourceTypes.includes(sourceType) || !documentTypes.includes(documentType)
      || !['draft','received'].includes(documentStatus)
      || !['private','organization','contract_participants'].includes(visibility)) {
      throw new BadRequestException('Check the document name, type, status and file format.');
    }
    const data = Buffer.from(encoded, 'base64');
    if (!data.length || data.length > 10 * 1024 * 1024 || data.toString('base64') !== encoded
      || !hasMatchingUploadSignature(mimeType, data)) {
      throw new BadRequestException('Use a valid PDF, JPG or PNG file no larger than 10 MB.');
    }
    const sourceId = body?.sourceId ? String(body.sourceId) : null;
    const organizationId = body?.organizationId ? String(body.organizationId) : null;
    if (sourceId) parseUuidParam(sourceId);
    if (organizationId) parseUuidParam(organizationId);
    if (visibility === 'organization') {
      if (!organizationId) throw new BadRequestException('An organization is required for organization-visible documents.');
      const member = await databasePool!.query(
        'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
        [organizationId, userId],
      );
      if (!member.rowCount) throw new ForbiddenException('You do not have access to this organization.');
    }
    if (['contract','contract_negotiation'].includes(sourceType) && (organizationId || visibility === 'organization')) {
      throw new BadRequestException('Contract documents must be private or shared only with the contract participants.');
    }
    if (['contract','contract_negotiation'].includes(sourceType) || visibility === 'contract_participants') {
      if (!sourceId || !['contract','contract_negotiation'].includes(sourceType)) {
        throw new BadRequestException('Contract-visible documents must reference a contract.');
      }
      const participant = await databasePool!.query(
        `SELECT 1 FROM marketplace_contracts c
         WHERE c.id = $1 AND (c.buyer_user_id = $2 OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2
         )) LIMIT 1`,
        [sourceId, userId],
      );
      if (!participant.rowCount) throw new ForbiddenException('Only contract participants can add shared documents.');
    }
    const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? JSON.stringify(body.metadata) : '{}';
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO user_documents
          (owner_user_id, organization_id, source_type, source_id, document_type,
           document_status, visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         RETURNING id, owner_user_id, organization_id, source_type, source_id,
                   document_type, document_status, visibility, file_name,
                   mime_type, file_size, file_sha256, metadata, created_at`,
        [userId, organizationId, sourceType, sourceId, documentType, documentStatus,
         visibility, fileName, mimeType, data.length, createHash('sha256').update(data).digest('hex'), data, metadata],
      );
      await client.query(
        `INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata)
         VALUES ($1,$2,'document.uploaded','user_document',$3,$4::jsonb)`,
        [userId, organizationId, result.rows[0].id, JSON.stringify({ source_type: sourceType, document_type: documentType, visibility, file_size: data.length })],
      );
      await client.query('COMMIT');
      return { document: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get(':id')
  async get(@Req() request: Request, @Param('id') id: string) {
    const userId = await this.currentUser(request);
    return { document: await this.accessibleDocument(id, userId) };
  }

  @Get(':id/download')
  async download(@Req() request: Request, @Param('id') id: string, @Res() response: Response) {
    const userId = await this.currentUser(request);
    const document = await this.accessibleDocument(id, userId, true);
    const safeName = String(document.file_name).replace(/[\\r\\n"]/g, '_');
    await databasePool!.query(
      `INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1,$2,'document.downloaded','user_document',$3,'{}'::jsonb)`,
      [userId, document.organization_id, document.id],
    );
    response.setHeader('Content-Type', document.mime_type);
    response.setHeader('Content-Length', String(document.file_size));
    response.setHeader('Content-Disposition', `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).send(document.file_data);
  }

  @Get(':id/preview')
  async preview(@Req() request: Request, @Param('id') id: string, @Res() response: Response) {
    const userId = await this.currentUser(request);
    const document = await this.accessibleDocument(id, userId, true);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(String(document.mime_type))) {
      throw new BadRequestException('This document type cannot be previewed.');
    }
    const safeName = String(document.file_name).replace(/[\\r\\n"]/g, '_');
    await databasePool!.query(
      `INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata)
       VALUES ($1,$2,'document.previewed','user_document',$3,'{}'::jsonb)`,
      [userId, document.organization_id, document.id],
    );
    response.setHeader('Content-Type', document.mime_type);
    response.setHeader('Content-Length', String(document.file_size));
    response.setHeader('Content-Disposition', `inline; filename="document"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' blob: data:; style-src 'unsafe-inline'; sandbox");
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).send(document.file_data);
  }
}

@Controller('market/listings')
class PublicListingsController {
  @Post()
  async createDraft(
    @Req() request: Request,
    @Body() body: { title?: string; description?: string; listingType?: string; division?: string; price?: string | number; quantityAvailable?: string | number | null },
  ) {
    parseBody(listingBodySchema, body);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to create an offer.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const listingType = body?.listingType;
    const division = body?.division || (listingType === 'b2b' ? 'b2b' : 'services');
    const priceText = String(body?.price ?? '').trim();
    const quantityText = body?.quantityAvailable === null || body?.quantityAvailable === undefined || String(body.quantityAvailable).trim() === ''
      ? null : String(body.quantityAvailable).trim();
    if (title.length < 3 || title.length > 140) throw new BadRequestException('Offer title must be between 3 and 140 characters.');
    if (description.length > 5000) throw new BadRequestException('Description must be 5,000 characters or fewer.');
    if (!['b2b', 'service'].includes(listingType || '')) throw new BadRequestException('Choose a valid listing type.');
    if (!['services', 'real_estate', 'software', 'b2b', 'industrial_trade', 'agriculture', 'finance_investment', 'institution_infrastructure', 'sports', 'entertainment'].includes(division)) throw new BadRequestException('Choose one of the ten contract categories.');
    if ((division === 'b2b') !== (listingType === 'b2b')) throw new BadRequestException('B2B listings must use the B2B listing type; other categories use the service listing type.');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(priceText)) throw new BadRequestException('Enter a valid price with up to two decimal places.');
    const priceMinorUnits = Math.round(Number(priceText) * 100);
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) throw new BadRequestException('Enter a valid non-negative price.');
    let quantity: number | null = null;
    if (quantityText !== null) {
      if (listingType === 'service') throw new BadRequestException('Service offers cannot have a quantity.');
      if (!/^\d{1,12}$/.test(quantityText) || !Number.isSafeInteger(Number(quantityText))) throw new BadRequestException('Quantity must be a whole number, or leave it blank.');
      quantity = Number(quantityText);
    }
    const membership = await databasePool.query(
      "SELECT o.id, o.country_code, o.default_currency, o.status FROM organization_members om JOIN organizations o ON o.id = om.organization_id WHERE om.user_id = $1 ORDER BY o.created_at DESC LIMIT 1",
      [userId],
    );
    if (!membership.rowCount) throw new BadRequestException('Create your business space before adding an offer.');
    const organization = membership.rows[0];
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query(
        "INSERT INTO listings (seller_organization_id, title, description, listing_type, division, price_minor_units, currency_code, country_code, quantity_available, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING id, title, description, listing_type, division, price_minor_units::text AS price_minor_units, currency_code, country_code, quantity_available, status, created_at",
        [organization.id, title, description, listingType, division, priceMinorUnits, organization.default_currency, organization.country_code, quantity],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'listing.draft_created','listing',$3,$4::jsonb)",
        [userId, organization.id, created.rows[0].id, JSON.stringify({ listing_type: listingType, division, business_status: organization.status })],
      );
      await client.query('COMMIT');
      return { listing: created.rows[0], message: 'Offer saved as a draft. It is not publicly visible yet.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to view your offers.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const result = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.division, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.status, l.created_at, l.updated_at,
              o.name AS seller_name
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       JOIN organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1
       ORDER BY l.created_at DESC, l.id
       LIMIT 100`,
      [session.rows[0].id],
    );
    return { data: result.rows };
  }


  @Post(':id/submit')
  async submitForReview(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to submit an offer.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE listings l
         SET status = 'pending_review', review_submitted_at = now(), reviewed_at = NULL, review_note = NULL, updated_at = now()
         WHERE l.id = $1 AND l.status IN ('draft', 'rejected')
           AND EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = l.seller_organization_id AND om.user_id = $2)
         RETURNING l.id, l.title, l.status, l.review_submitted_at`,
        [id, userId],
      );
      if (!result.rowCount) {
        const existing = await client.query(
          `SELECT l.status, EXISTS (SELECT 1 FROM organization_members om JOIN listings own ON own.seller_organization_id = om.organization_id WHERE own.id = l.id AND om.user_id = $2) AS is_owner
           FROM listings l WHERE l.id = $1`,
          [id, userId],
        );
        if (!existing.rowCount || !existing.rows[0].is_owner) throw new NotFoundException('Offer not found in your business space.');
        throw new ConflictException(`This offer cannot be submitted from its current status: ${existing.rows[0].status}.`);
      }
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) SELECT $1, l.seller_organization_id, 'listing.submitted_for_review', 'listing', l.id, '{}'::jsonb FROM listings l WHERE l.id = $2",
        [userId, id],
      );
      await client.query('COMMIT');
      return { listing: result.rows[0], message: 'Offer submitted for review. It will not appear publicly until approved.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id')
  async updateDraft(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { title?: string; description?: string; listingType?: string; division?: string; price?: string | number; quantityAvailable?: string | number | null },
  ) {
    parseUuidParam(id);
    parseBody(listingBodySchema, body);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to edit an offer.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const listingType = body?.listingType;
    const division = body?.division || (listingType === 'b2b' ? 'b2b' : 'services');
    const priceText = String(body?.price ?? '').trim();
    const quantityText = body?.quantityAvailable === null || body?.quantityAvailable === undefined || String(body.quantityAvailable).trim() === ''
      ? null : String(body.quantityAvailable).trim();
    if (title.length < 3 || title.length > 140) throw new BadRequestException('Offer title must be between 3 and 140 characters.');
    if (description.length > 5000) throw new BadRequestException('Description must be 5,000 characters or fewer.');
    if (!['b2b', 'service'].includes(listingType || '')) throw new BadRequestException('Choose a valid listing type.');
    if (!['services', 'real_estate', 'software', 'b2b', 'industrial_trade', 'agriculture', 'finance_investment', 'institution_infrastructure', 'sports', 'entertainment'].includes(division)) throw new BadRequestException('Choose one of the ten contract categories.');
    if ((division === 'b2b') !== (listingType === 'b2b')) throw new BadRequestException('B2B listings must use the B2B listing type; other categories use the service listing type.');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(priceText)) throw new BadRequestException('Enter a valid price with up to two decimal places.');
    const priceMinorUnits = Math.round(Number(priceText) * 100);
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) throw new BadRequestException('Enter a valid non-negative price.');
    let quantity: number | null = null;
    if (quantityText !== null) {
      if (listingType === 'service') throw new BadRequestException('Service offers cannot have a quantity.');
      if (!/^\d{1,12}$/.test(quantityText) || !Number.isSafeInteger(Number(quantityText))) throw new BadRequestException('Quantity must be a whole number, or leave it blank.');
      quantity = Number(quantityText);
    }
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE listings l
         SET title = $1, description = $2, listing_type = $3, division = $4, price_minor_units = $5, quantity_available = $6, updated_at = now()
         WHERE l.id = $7 AND l.status = 'draft'
           AND EXISTS (
             SELECT 1 FROM organization_members om
             WHERE om.organization_id = l.seller_organization_id AND om.user_id = $8
           )
         RETURNING l.id, l.title, l.description, l.listing_type, l.division, l.price_minor_units::text AS price_minor_units,
                   l.currency_code, l.country_code, l.quantity_available, l.status, l.created_at, l.updated_at`,
        [title, description, listingType, division, priceMinorUnits, quantity, id, userId],
      );
      if (!updated.rowCount) {
        const exists = await client.query('SELECT status FROM listings WHERE id = $1', [id]);
        if (!exists.rowCount) throw new NotFoundException('Offer not found.');
        if (exists.rows[0].status !== 'draft') throw new ConflictException('Only draft offers can be edited.');
        throw new NotFoundException('Offer not found in your business space.');
      }
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, (SELECT seller_organization_id FROM listings WHERE id = $3), 'listing.draft_updated', 'listing', $3, $2::jsonb)",
        [userId, JSON.stringify({ listing_type: listingType, division }), id],
      );
      await client.query('COMMIT');
      return { listing: updated.rows[0], message: 'Draft offer updated.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Delete(':id')
  async deleteDraft(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to delete an offer.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const deleted = await client.query(
        `DELETE FROM listings l
         WHERE l.id = $1 AND l.status = 'draft'
           AND EXISTS (
             SELECT 1 FROM organization_members om
             WHERE om.organization_id = l.seller_organization_id AND om.user_id = $2
           )
         RETURNING l.id, l.seller_organization_id`,
        [id, userId],
      );
      if (!deleted.rowCount) {
        const exists = await client.query('SELECT status FROM listings WHERE id = $1', [id]);
        if (!exists.rowCount) throw new NotFoundException('Offer not found.');
        if (exists.rows[0].status !== 'draft') throw new ConflictException('Only draft offers can be deleted.');
        throw new NotFoundException('Offer not found in your business space.');
      }
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'listing.draft_deleted', 'listing', $3, '{}'::jsonb)",
        [userId, deleted.rows[0].seller_organization_id, deleted.rows[0].id],
      );
      await client.query('COMMIT');
      return { success: true, id: deleted.rows[0].id, message: 'Draft offer deleted.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    parseUuidParam(id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) {
      throw new NotFoundException('Listing not found.');
    }

    const result = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.division, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.created_at, l.updated_at,
              o.name AS seller_name, o.country_code AS seller_country_code,
              c.name AS category_name,
              COALESCE((SELECT json_agg(json_build_object('url', lm.media_url, 'alt', lm.alt_text) ORDER BY lm.sort_order, lm.created_at)
                        FROM listing_media lm WHERE lm.listing_id = l.id), '[]'::json) AS media
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.id = $1 AND l.status = 'published' AND o.status = 'active'
       LIMIT 1`,
      [id],
    );
    if (!result.rowCount) throw new NotFoundException('Listing not found.');
    return { data: result.rows[0] };
  }

  @Get()
  async browse(
    @Query('q') search?: string,
    @Query('country') country?: string,
    @Query('type') type?: string,
    @Query('division') division?: string,
    @Query('category') category?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    parseBody(marketplaceBrowseQuerySchema, { search, country, type, division, category, page: pageValue, limit: limitValue });
    if (!databasePool) {
      return { data: [], pagination: { page: 1, limit: 20, total: 0 }, message: 'Marketplace database is not configured.' };
    }

    const page = pageValue === undefined ? 1 : Number(pageValue);
    const limit = limitValue === undefined ? 20 : Number(limitValue);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('page must be a positive integer and limit must be between 1 and 50.');
    }
    if (type && !['b2b', 'service'].includes(type)) {
      throw new BadRequestException('type must be service or b2b.');
    }
    if (division && !['services', 'real_estate', 'software', 'b2b', 'industrial_trade', 'agriculture', 'finance_investment', 'institution_infrastructure', 'sports', 'entertainment'].includes(division)) throw new BadRequestException('division must be one of the ten contract categories.');
    if (country && !/^[A-Za-z]{2}$/.test(country)) {
      throw new BadRequestException('country must be a two-letter country code.');
    }
    if (category && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category)) {
      throw new BadRequestException('category must be a valid category UUID.');
    }

    const conditions = ["l.status = 'published'", "o.status = 'active'"];
    const values: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      conditions.push(clause.replace('?', `$${values.length}`));
    };

    if (search?.trim()) {
      const pattern = `%${search.trim().slice(0, 100)}%`;
      values.push(pattern, pattern);
      conditions.push(`(l.title ILIKE $${values.length - 1} OR l.description ILIKE $${values.length})`);
    }
    if (country) add('l.country_code = ?', country.toUpperCase());
    if (type) add('l.listing_type = ?', type);
    if (division) add('l.division = ?', division);
    if (category) add('l.category_id = ?', category);

    const where = conditions.join(' AND ');
    const countResult = await databasePool.query(
      `SELECT COUNT(*)::int AS total FROM listings l JOIN organizations o ON o.id = l.seller_organization_id WHERE ${where}`,
      values,
    );
    const total = countResult.rows[0].total as number;
    const offset = (page - 1) * limit;
    const resultValues = [...values, limit, offset];
    const listingsResult = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.division, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.created_at,
              o.name AS seller_name, c.name AS category_name,
              (SELECT lm.media_url FROM listing_media lm WHERE lm.listing_id = l.id ORDER BY lm.sort_order, lm.created_at LIMIT 1) AS cover_image
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE ${where}
       ORDER BY l.created_at DESC, l.id
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      resultValues,
    );

    return {
      data: listingsResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}


@Controller('market/enquiries')
class EnquiriesController {
  private async authenticatedUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to use marketplace enquiries.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session.rows[0].id as string;
  }

  @Post()
  async create(@Req() request: Request, @Body() body: { listingId?: string; message?: string }) {
    parseBody(enquiryCreateBodySchema, body);
    const userId = await this.authenticatedUser(request);
    const listingId = typeof body?.listingId === 'string' ? body.listingId.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
      throw new BadRequestException('listingId must be a valid listing UUID.');
    }
    if (message.length < 5 || message.length > 2000) {
      throw new BadRequestException('Your enquiry must be between 5 and 2,000 characters.');
    }

    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const listing = await client.query(
        `SELECT l.id, l.title AS listing_title, l.seller_organization_id, o.name AS seller_name
         FROM listings l
         JOIN organizations o ON o.id = l.seller_organization_id
         WHERE l.id = $1 AND l.status = 'published' AND o.status = 'active'
         LIMIT 1
         FOR SHARE OF l, o`,
        [listingId],
      );
      if (!listing.rowCount) throw new NotFoundException('This listing is not available for enquiries.');
      const target = listing.rows[0];
      const sellerMembership = await client.query(
        'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
        [target.seller_organization_id, userId],
      );
      if (sellerMembership.rowCount) throw new BadRequestException('You cannot send an enquiry about your own listing.');

      const created = await client.query(
        "INSERT INTO marketplace_enquiries (listing_id, buyer_user_id, message, status) VALUES ($1, $2, $3, 'open') RETURNING id, listing_id, buyer_user_id, message, status, created_at",
        [listingId, userId, message],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'marketplace.enquiry_created', 'enquiry', $3, $4::jsonb)",
        [userId, target.seller_organization_id, created.rows[0].id, JSON.stringify({ listing_id: listingId })],
      );
      await client.query(
        "INSERT INTO user_notifications (user_id, category, title, body, icon, action_url) SELECT om.user_id, 'Contracts', 'New marketplace enquiry', $1, 'message-square', $2 FROM organization_members om WHERE om.organization_id = $3 AND om.user_id <> $4 AND om.member_role IN ('owner','admin')",
        ['A buyer enquired about ' + target.listing_title + '.', '/messages/' + created.rows[0].id, target.seller_organization_id, userId],
      );
      await client.query('COMMIT');
      return { data: { ...created.rows[0], seller_name: target.seller_name }, message: 'Enquiry sent to the seller.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async authorizedEnquiry(enquiryId: string, userId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(enquiryId)) {
      throw new BadRequestException('id must be a valid enquiry UUID.');
    }
    const result = await databasePool!.query(
      `SELECT e.id, e.listing_id, e.buyer_user_id, e.message, e.status, e.created_at,
              l.seller_organization_id, l.title AS listing_title, o.name AS seller_name, buyer.display_name AS buyer_name
       FROM marketplace_enquiries e
       JOIN listings l ON l.id = e.listing_id
       JOIN organizations o ON o.id = l.seller_organization_id
       JOIN users buyer ON buyer.id = e.buyer_user_id
       WHERE e.id = $1
         AND (e.buyer_user_id = $2 OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = l.seller_organization_id AND om.user_id = $2
         ))
       LIMIT 1`,
      [enquiryId, userId],
    );
    if (!result.rowCount) throw new NotFoundException('Enquiry not found.');
    return result.rows[0];
  }

  @Get(':id/messages')
  async messages(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.authenticatedUser(request);
    const enquiry = await this.authorizedEnquiry(id, userId);
    await databasePool!.query(
      `INSERT INTO enquiry_reads (enquiry_id, user_id, last_read_at)
       VALUES ($1, $2, now())
       ON CONFLICT (enquiry_id, user_id)
       DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [id, userId],
    );
    const replies = await databasePool!.query(
      `SELECT m.id, m.enquiry_id, m.sender_user_id, u.display_name AS sender_name,
              m.message, m.created_at
       FROM enquiry_messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.enquiry_id = $1
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 500`,
      [id],
    );
    return { data: { enquiry, messages: [{ id: 'initial-' + enquiry.id, sender_user_id: enquiry.buyer_user_id, sender_name: enquiry.buyer_name, message: enquiry.message, created_at: enquiry.created_at, initial: true }, ...replies.rows] } };
  }

  @Post(':id/messages')
  async reply(@Param('id') id: string, @Req() request: Request, @Body() body: { message?: string }) {
    parseUuidParam(id);
    parseBody(enquiryReplyBodySchema, body);
    const userId = await this.authenticatedUser(request);
    const enquiry = await this.authorizedEnquiry(id, userId);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > 2000) {
      throw new BadRequestException('Your message must be between 1 and 2,000 characters.');
    }
    if (enquiry.status === 'closed' || enquiry.status === 'reported') {
      throw new ConflictException('This enquiry is no longer open for replies.');
    }
    const isBuyer = enquiry.buyer_user_id === userId;
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      // Re-check the conversation status under a row lock to avoid a reply racing with closure.
      const locked = await client.query(
        'SELECT status FROM marketplace_enquiries WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!locked.rowCount) throw new NotFoundException('Enquiry not found.');
      if (locked.rows[0].status === 'closed' || locked.rows[0].status === 'reported') {
        throw new ConflictException('This enquiry is no longer open for replies.');
      }
      const inserted = await client.query(
        'INSERT INTO enquiry_messages (enquiry_id, sender_user_id, message) VALUES ($1, $2, $3) RETURNING id, enquiry_id, sender_user_id, message, created_at',
        [id, userId, message],
      );
      const sender = await client.query('SELECT display_name FROM users WHERE id = $1 LIMIT 1', [userId]);
      await client.query(
        `UPDATE marketplace_enquiries SET status = CASE WHEN $2 = true THEN 'responded' ELSE status END, updated_at = now() WHERE id = $1`,
        [id, !isBuyer],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'marketplace.enquiry_message_sent', 'enquiry', $3, $4::jsonb)",
        [userId, enquiry.seller_organization_id, id, JSON.stringify({ direction: isBuyer ? 'buyer_reply' : 'seller_reply' })],
      );
      if (isBuyer) {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon, action_url) SELECT om.user_id, 'Contracts', 'New enquiry reply', $1, 'message-square', $2 FROM organization_members om WHERE om.organization_id = $3 AND om.user_id <> $4 AND om.member_role IN ('owner','admin')",
          ['A buyer replied about ' + enquiry.listing_title + '.', '/messages/' + id, enquiry.seller_organization_id, userId],
        );
      } else {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon, action_url) VALUES ($1, 'Contracts', 'New enquiry reply', $2, 'message-square', $3)",
          [enquiry.buyer_user_id, 'The seller replied about ' + enquiry.listing_title + '.', '/messages/' + id],
        );
      }
      await client.query('COMMIT');
      return { data: { ...inserted.rows[0], sender_name: sender.rows[0]?.display_name ?? 'TradeMate user' }, message: 'Reply sent.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query(
      `SELECT e.id, e.listing_id, e.buyer_user_id, e.message, e.status, e.created_at, e.updated_at,
              l.title AS listing_title, l.currency_code, l.price_minor_units::text AS price_minor_units,
              o.name AS seller_name, buyer.display_name AS buyer_name,
              CASE WHEN e.buyer_user_id = $1 THEN 'sent' ELSE 'received' END AS direction,
              (
                CASE
                  WHEN e.buyer_user_id <> $1
                   AND COALESCE(er.last_read_at, '-infinity'::timestamptz) < e.created_at
                  THEN 1 ELSE 0
                END
                + (
                  SELECT COUNT(*)::int
                  FROM enquiry_messages unread
                  WHERE unread.enquiry_id = e.id
                    AND unread.sender_user_id <> $1
                    AND unread.created_at > COALESCE(er.last_read_at, '-infinity'::timestamptz)
                )
              ) AS unread_count
       FROM marketplace_enquiries e
       LEFT JOIN enquiry_reads er ON er.enquiry_id = e.id AND er.user_id = $1
       JOIN listings l ON l.id = e.listing_id
       JOIN organizations o ON o.id = l.seller_organization_id
       JOIN users buyer ON buyer.id = e.buyer_user_id
       WHERE e.buyer_user_id = $1
          OR EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = l.seller_organization_id AND om.user_id = $1
          )
       ORDER BY e.created_at DESC, e.id
       LIMIT 100`,
      [userId],
    );
    return { data: result.rows };
  }
}





@Controller('market/contracts')
class MarketplaceContractsController {
  private validateContractId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException("id must be a valid contract UUID.");
    }
  }

  private async authenticatedUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to manage contracts.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session.rows[0].id as string;
  }

  private async authorizedContract(id: string, userId: string) {
    this.validateContractId(id);
    const result = await databasePool!.query(
      `SELECT c.*, l.title AS listing_title, l.listing_type, l.division, o.name AS seller_name,
              buyer.display_name AS buyer_name,
              (c.buyer_user_id = $2) AS is_buyer,
              EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2
              ) AS is_seller
       FROM marketplace_contracts c
       JOIN listings l ON l.id = c.listing_id
       JOIN organizations o ON o.id = c.seller_organization_id
       JOIN users buyer ON buyer.id = c.buyer_user_id
       WHERE c.id = $1
         AND (c.buyer_user_id = $2 OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2
         ))
       LIMIT 1`,
      [id, userId],
    );
    if (!result.rowCount) throw new NotFoundException('Contract not found.');
    return result.rows[0];
  }

  @Post()
  async create(
    @Req() request: Request,
    @Body() body: {
      listingId?: string;
      amount?: string | number;
      scope?: string;
      terms?: string;
      startDate?: string;
      completionDate?: string;
    },
  ) {
    parseBody(contractCreateBodySchema, body);
    const buyerId = await this.authenticatedUser(request);
    const listingId = typeof body?.listingId === 'string' ? body.listingId.trim() : '';
    const amountText = String(body?.amount ?? '').trim();
    const scope = typeof body?.scope === 'string' ? body.scope.trim() : '';
    const terms = typeof body?.terms === 'string' ? body.terms.trim() : '';
    const startDate = typeof body?.startDate === 'string' && body.startDate.trim() ? body.startDate.trim() : null;
    const completionDate = typeof body?.completionDate === 'string' && body.completionDate.trim() ? body.completionDate.trim() : null;
    const validDate = (value: string | null) => value === null ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) &&
       new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
      throw new BadRequestException('listingId must be a valid offer UUID.');
    }
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amountText)) {
      throw new BadRequestException('Enter a proposed contract value with up to two decimal places.');
    }
    if (scope.length < 5 || scope.length > 5000) {
      throw new BadRequestException('Contract scope must be between 5 and 5,000 characters.');
    }
    if (terms.length < 5 || terms.length > 10000) {
      throw new BadRequestException('Contract terms must be between 5 and 10,000 characters.');
    }
    if (!validDate(startDate) || !validDate(completionDate)) {
      throw new BadRequestException('Use valid dates in YYYY-MM-DD format.');
    }
    if (startDate && completionDate && completionDate < startDate) {
      throw new BadRequestException('The completion date cannot be before the start date.');
    }
    const amountParts = amountText.split(".");
    const amountMinorUnits = (BigInt(amountParts[0]) * 100n + BigInt(((amountParts[1] || "") + "00").slice(0, 2))).toString();

    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const listing = await client.query(
        `SELECT l.id, l.title, l.listing_type, l.seller_organization_id, l.currency_code,
                l.status, o.status AS organization_status
         FROM listings l
         JOIN organizations o ON o.id = l.seller_organization_id
         WHERE l.id = $1 AND l.status = 'published' AND o.status = 'active'
         LIMIT 1
         FOR SHARE OF l, o`,
        [listingId],
      );
      if (!listing.rowCount) throw new NotFoundException('This published contract-category offer is not available for a contract.');
      const offer = listing.rows[0];
      const sellerMembership = await client.query(
        'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
        [offer.seller_organization_id, buyerId],
      );
      if (sellerMembership.rowCount) throw new BadRequestException('You cannot propose a contract to your own business space.');

      const created = await client.query(
        `INSERT INTO marketplace_contracts
         (listing_id, buyer_user_id, seller_organization_id, title, scope, terms,
          amount_minor_units, currency_code, requested_start_date, requested_completion_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed')
         RETURNING id, listing_id, buyer_user_id, seller_organization_id, title, scope, terms,
                   amount_minor_units::text AS amount_minor_units, currency_code,
                   requested_start_date, requested_completion_date, status, created_at`,
        [listingId, buyerId, offer.seller_organization_id, offer.title, scope, terms,
         String(amountMinorUnits), offer.currency_code, startDate, completionDate],
      );
      const contractPdf = buildContractRecordPdf(created.rows[0], 'proposal');
      await client.query(
        `INSERT INTO user_documents
          (owner_user_id, source_type, source_id, document_type, document_status,
           visibility, file_name, mime_type, file_size, file_sha256, file_data, metadata)
         VALUES ($1,'contract',$2,'contract','generated','contract_participants',
                 $3,'application/pdf',$4,$5,$6,$7::jsonb)`,
        [buyerId, created.rows[0].id,
         'TradeMate-Contract-Proposal-' + created.rows[0].id + '.pdf',
         contractPdf.length, createHash('sha256').update(contractPdf).digest('hex'),
         contractPdf, JSON.stringify({ record_type: 'contract_proposal', contract_status: 'proposed', generated_at: new Date().toISOString(), signature_status: 'not_signed' })],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_proposed','contract',$3,$4::jsonb)",
        [buyerId, offer.seller_organization_id, created.rows[0].id, JSON.stringify({ listing_id: listingId, listing_type: offer.listing_type })],
      );
      await client.query(
        "INSERT INTO user_notifications (user_id, category, title, body, icon) SELECT om.user_id, 'Contracts', 'New contract proposal', $1, 'doc' FROM organization_members om WHERE om.organization_id = $2 AND om.user_id <> $3 AND om.member_role IN ('owner','admin')",
        ['A buyer sent a proposal for ' + offer.title + '.', offer.seller_organization_id, buyerId],
      );
      await client.query('COMMIT');
      return { data: created.rows[0], message: 'Contract proposal sent to the business for review.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query(
      `SELECT c.id, c.listing_id, c.buyer_user_id, c.seller_organization_id, c.title,
              c.scope, c.terms, c.amount_minor_units::text AS amount_minor_units, c.currency_code,
              c.requested_start_date, c.requested_completion_date, c.status,
              c.accepted_at, c.buyer_confirmed_at, c.seller_confirmed_at, c.completed_at,
              c.created_at, c.updated_at, l.listing_type, o.name AS seller_name,
              buyer.display_name AS buyer_name, l.division,
              (SELECT om.member_role FROM organization_members om WHERE om.organization_id = c.seller_organization_id AND om.user_id = $1 LIMIT 1) AS seller_member_role,
              CASE WHEN c.buyer_user_id = $1 THEN 'sent' ELSE 'received' END AS direction
       FROM marketplace_contracts c
       JOIN listings l ON l.id = c.listing_id
       JOIN organizations o ON o.id = c.seller_organization_id
       JOIN users buyer ON buyer.id = c.buyer_user_id
       WHERE c.buyer_user_id = $1
          OR EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = c.seller_organization_id AND om.user_id = $1
          )
       ORDER BY c.created_at DESC, c.id
       LIMIT 100`,
      [userId],
    );
    return { data: result.rows };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.authenticatedUser(request);
    return { data: await this.authorizedContract(id, userId) };
  }

  @Patch(':id/respond')
  async respond(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { decision?: string },
  ) {
    parseUuidParam(id);
    parseBody(contractDecisionBodySchema, body);
    this.validateContractId(id);
    const userId = await this.authenticatedUser(request);
    if (!['accept', 'reject'].includes(body?.decision || '')) {
      throw new BadRequestException('decision must be accept or reject.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT c.id, c.status, c.buyer_user_id, c.seller_organization_id,
                EXISTS (SELECT 1 FROM organization_members om
                        WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2 AND om.member_role IN ('owner', 'admin')) AS can_manage_contract
         FROM marketplace_contracts c WHERE c.id = $1 FOR UPDATE`,
        [id, userId],
      );
      if (!current.rowCount) throw new NotFoundException('Contract not found.');
      if (!current.rows[0].can_manage_contract || current.rows[0].buyer_user_id === userId) throw new NotFoundException('Contract not found.');
      if (current.rows[0].status !== 'proposed') throw new ConflictException('This contract proposal is no longer awaiting a response.');
      const status = body.decision === 'accept' ? 'accepted' : 'rejected';
      const updated = await client.query(
        `UPDATE marketplace_contracts
         SET status = $2, accepted_by_user_id = CASE WHEN $2 = 'accepted' THEN $3::uuid ELSE NULL::uuid END,
             accepted_at = CASE WHEN $2 = 'accepted' THEN now() ELSE NULL END, updated_at = now()
         WHERE id = $1
         RETURNING id, status, accepted_by_user_id, accepted_at, updated_at`,
        [id, status, userId],
      );
      const contractRecord = await client.query('SELECT * FROM marketplace_contracts WHERE id = $1', [id]);
      await saveContractVaultRecord(client, { ...contractRecord.rows[0], status }, status, current.rows[0].buyer_user_id);
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,$3,'contract',$4,$5::jsonb)",
        [userId, current.rows[0].seller_organization_id, status === 'accepted' ? 'marketplace.contract_accepted' : 'marketplace.contract_rejected', id, JSON.stringify({ status })],
      );
      await client.query(
        "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'Contracts', $2, $3, 'doc')",
        [current.rows[0].buyer_user_id, status === 'accepted' ? 'Contract accepted' : 'Contract declined', status === 'accepted' ? 'Your contract proposal has been accepted.' : 'Your contract proposal was declined.'],
      );
      await client.query('COMMIT');
      return { data: updated.rows[0], message: status === 'accepted' ? 'Contract accepted.' : 'Contract proposal declined.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    this.validateContractId(id);
    const userId = await this.authenticatedUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT id, buyer_user_id, seller_organization_id, status FROM marketplace_contracts WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!current.rowCount || current.rows[0].buyer_user_id !== userId) throw new NotFoundException('Contract not found.');
      if (current.rows[0].status !== 'proposed') throw new ConflictException('Only a pending contract proposal can be cancelled.');
      const updated = await client.query(
        "UPDATE marketplace_contracts SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING id, status, updated_at",
        [id],
      );
      const contractRecord = await client.query('SELECT * FROM marketplace_contracts WHERE id = $1', [id]);
      await saveContractVaultRecord(client, { ...contractRecord.rows[0], status: 'cancelled' }, 'cancelled', current.rows[0].buyer_user_id);
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_cancelled','contract',$3,'{}'::jsonb)",
        [userId, current.rows[0].seller_organization_id, id],
      );
      await client.query(
        "INSERT INTO user_notifications (user_id, category, title, body, icon) SELECT om.user_id, 'Contracts', 'Contract proposal cancelled', 'The buyer cancelled a pending contract proposal.', 'doc' FROM organization_members om WHERE om.organization_id = $1 AND om.user_id <> $2 AND om.member_role IN ('owner','admin')",
        [current.rows[0].seller_organization_id, userId],
      );
      await client.query('COMMIT');
      return { data: updated.rows[0], message: 'Contract proposal cancelled.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id/confirm-completion')
  async confirmCompletion(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    this.validateContractId(id);
    const userId = await this.authenticatedUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT c.id, c.status, c.buyer_user_id, c.seller_organization_id,
                c.buyer_confirmed_at, c.seller_confirmed_at,
                EXISTS (SELECT 1 FROM organization_members om
                        WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2 AND om.member_role IN ('owner', 'admin')) AS can_manage_contract
         FROM marketplace_contracts c WHERE c.id = $1 FOR UPDATE`,
        [id, userId],
      );
      if (!current.rowCount) throw new NotFoundException('Contract not found.');
      const contract = current.rows[0];
      const isBuyer = contract.buyer_user_id === userId;
      if (!isBuyer && !contract.can_manage_contract) throw new NotFoundException('Contract not found.');
      if (contract.status !== 'accepted') throw new ConflictException('Only an accepted contract can be confirmed as fulfilled.');
      const buyerConfirmed = Boolean(contract.buyer_confirmed_at) || isBuyer;
      const sellerActor = Boolean(contract.can_manage_contract) && !isBuyer;
      const sellerConfirmed = Boolean(contract.seller_confirmed_at) || sellerActor;
      const completed = buyerConfirmed && sellerConfirmed;
      const updated = await client.query(
        `UPDATE marketplace_contracts
         SET buyer_confirmed_at = CASE WHEN $2 THEN COALESCE(buyer_confirmed_at, now()) ELSE buyer_confirmed_at END,
             seller_confirmed_at = CASE WHEN $3 THEN COALESCE(seller_confirmed_at, now()) ELSE seller_confirmed_at END,
             status = CASE WHEN $4 THEN 'completed' ELSE status END,
             completed_at = CASE WHEN $4 THEN COALESCE(completed_at, now()) ELSE completed_at END,
             updated_at = now()
         WHERE id = $1
         RETURNING id, status, buyer_confirmed_at, seller_confirmed_at, completed_at, updated_at`,
        [id, isBuyer, sellerActor, completed],
      );
      const contractRecord = await client.query('SELECT * FROM marketplace_contracts WHERE id = $1', [id]);
      await saveContractVaultRecord(client, { ...contractRecord.rows[0], ...updated.rows[0] }, completed ? 'completed' : 'fulfilment-confirmed', contract.buyer_user_id);
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_fulfilment_confirmed','contract',$3,$4::jsonb)",
        [userId, contract.seller_organization_id, id, JSON.stringify({ completed })],
      );
      if (isBuyer && !contract.buyer_confirmed_at) {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon) SELECT om.user_id, 'Contracts', $2, $3, 'doc' FROM organization_members om WHERE om.organization_id = $1 AND om.user_id <> $4 AND om.member_role IN ('owner','admin')",
          [contract.seller_organization_id, completed ? 'Contract completed' : 'Buyer confirmed fulfilment', completed ? 'Both parties confirmed fulfilment. The contract is complete.' : 'The buyer confirmed fulfilment. Please confirm your side.', userId],
        );
      } else if (sellerActor && !contract.seller_confirmed_at) {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'Contracts', $2, $3, 'doc')",
          [contract.buyer_user_id, completed ? 'Contract completed' : 'Seller confirmed fulfilment', completed ? 'Both parties confirmed fulfilment. The contract is complete.' : 'The seller confirmed fulfilment. Please confirm your side.'],
        );
      }
      await client.query('COMMIT');
      return { data: updated.rows[0], message: completed ? 'Both parties confirmed fulfilment. Contract completed.' : 'Your confirmation is recorded. The other party must also confirm fulfilment.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get(':id/messages')
  async messages(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.authenticatedUser(request);
    const contract = await this.authorizedContract(id, userId);
    const result = await databasePool!.query(
      `SELECT m.id, m.contract_id, m.sender_user_id, u.display_name AS sender_name,
              m.message, m.created_at,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', d.id, 'file_name', d.file_name, 'mime_type', d.mime_type,
                  'file_size', d.file_size, 'created_at', d.created_at
                ) ORDER BY d.created_at, d.id)
                FROM marketplace_contract_message_documents md
                JOIN user_documents d ON d.id = md.document_id
                WHERE md.contract_message_id = m.id AND md.contract_id = m.contract_id
                  AND d.source_type = 'contract_negotiation' AND d.source_id = m.contract_id
                  AND d.visibility = 'contract_participants'
              ), '[]'::jsonb) AS attachments
       FROM marketplace_contract_messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.contract_id = $1
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 500`,
      [id],
    );
    return { data: { contract, messages: result.rows } };
  }

  @Post(':id/messages')
  async reply(@Param('id') id: string, @Req() request: Request, @Body() body: { message?: string; attachmentDocumentIds?: string[] }) {
    parseUuidParam(id);
    parseBody(contractMessageBodySchema, body);
    const userId = await this.authenticatedUser(request);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > 2000) {
      throw new BadRequestException('Your message must be between 1 and 2,000 characters.');
    }
    const attachmentDocumentIds = Array.isArray(body?.attachmentDocumentIds) ? body.attachmentDocumentIds : [];
    if (attachmentDocumentIds.length > 10
      || attachmentDocumentIds.some((value) => typeof value !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      || new Set(attachmentDocumentIds).size !== attachmentDocumentIds.length) {
      throw new BadRequestException('Choose up to 10 valid, distinct contract documents.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT c.id, c.status, c.buyer_user_id, c.seller_organization_id,
                (c.buyer_user_id = $2) AS is_buyer,
                EXISTS (SELECT 1 FROM organization_members om
                        WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2) AS is_seller
         FROM marketplace_contracts c WHERE c.id = $1 FOR UPDATE`,
        [id, userId],
      );
      if (!current.rowCount || (!current.rows[0].is_buyer && !current.rows[0].is_seller)) {
        throw new NotFoundException('Contract not found.');
      }
      if (!['proposed', 'accepted'].includes(current.rows[0].status)) {
        throw new ConflictException('This contract is closed for new messages.');
      }
      if (attachmentDocumentIds.length) {
        const ownedDocuments = await client.query(
          `SELECT id FROM user_documents
           WHERE id = ANY($1::uuid[]) AND owner_user_id = $2 AND source_type = 'contract_negotiation'
             AND source_id = $3 AND visibility = 'contract_participants'
           FOR SHARE`,
          [attachmentDocumentIds, userId, id],
        );
        if (ownedDocuments.rowCount !== attachmentDocumentIds.length) {
          throw new ForbiddenException('Only your own files uploaded to this contract can be attached to a message.');
        }
      }
      const inserted = await client.query(
        'INSERT INTO marketplace_contract_messages (contract_id, sender_user_id, message) VALUES ($1,$2,$3) RETURNING id, contract_id, sender_user_id, message, created_at',
        [id, userId, message],
      );
      if (attachmentDocumentIds.length) {
        await client.query(
          `INSERT INTO marketplace_contract_message_documents
            (contract_message_id, document_id, contract_id, attached_by_user_id)
           SELECT $1, d.id, $2, $3 FROM user_documents d
           WHERE d.id = ANY($4::uuid[]) AND d.owner_user_id = $3
             AND d.source_type = 'contract_negotiation' AND d.source_id = $2
             AND d.visibility = 'contract_participants'`,
          [inserted.rows[0].id, id, userId, attachmentDocumentIds],
        );
      }
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_message_sent','contract',$3,$4::jsonb)",
        [userId, current.rows[0].seller_organization_id, id, JSON.stringify({ attachment_count: attachmentDocumentIds.length })],
      );
      if (current.rows[0].is_buyer) {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon) SELECT om.user_id, 'Contracts', 'New contract message', $3, 'conversation' FROM organization_members om WHERE om.organization_id = $1 AND om.user_id <> $2 AND om.member_role IN ('owner','admin')",
          [current.rows[0].seller_organization_id, userId, attachmentDocumentIds.length ? 'The buyer sent a contract message with ' + attachmentDocumentIds.length + ' file attachment(s).' : 'The buyer sent a new message on a contract.'],
        );
      } else {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'Contracts', 'New contract message', $2, 'conversation')",
          [current.rows[0].buyer_user_id, attachmentDocumentIds.length ? 'The seller sent a contract message with ' + attachmentDocumentIds.length + ' file attachment(s).' : 'The seller sent a new message on a contract.'],
        );
      }
      await client.query('COMMIT');
      const sender = await databasePool!.query('SELECT display_name FROM users WHERE id = $1 LIMIT 1', [userId]);
      return { data: { ...inserted.rows[0], sender_name: sender.rows[0]?.display_name ?? 'TradeMate user', attachments: attachmentDocumentIds }, message: 'Contract message sent.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}


@Controller('market/trades')
class MarketplaceTradesController {
  @Get('activity')
  async activity(@Query('view') view?: string, @Query('market') market?: string, @Query('limit') limitValue?: string) {
    parseBody(marketActivityQuerySchema, { view, market, limit: limitValue });
    if (!databasePool) return { source: 'TradeMate marketplace', as_of: new Date().toISOString(), data: [], message: 'Marketplace database is not configured.' };
    if (!view || !['book', 'trades'].includes(view)) throw new BadRequestException('view must be book or trades.');
    const limit = limitValue === undefined ? 100 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be between 1 and 100.');
    const category = (market || 'all').toLowerCase();
    if (!['all', 'b2b', 'services', 'p2p'].includes(category)) throw new BadRequestException('market must be all, b2b, services, or p2p.');
    if (view === 'book') {
      const values: unknown[] = [limit];
      const listingFilter = category === 'b2b' ? " AND l.listing_type = 'b2b'" : category === 'services' ? " AND l.listing_type = 'service'" : category === 'p2p' ? ' AND 1=0' : '';
      const p2pFilter = category === 'p2p' || category === 'all' ? '' : ' AND 1=0';
      const result = await databasePool.query(
        `SELECT * FROM (
          SELECT l.id::text AS reference, l.title AS instrument, UPPER(l.listing_type) AS side,
                 l.price_minor_units::text AS price, l.currency_code AS currency,
                 l.quantity_available::text AS quantity, l.created_at AS occurred_at,
                 'TradeMate marketplace'::text AS source, CASE WHEN l.listing_type='service' THEN 'Services' ELSE 'B2B' END AS market
          FROM listings l JOIN organizations o ON o.id=l.seller_organization_id
          WHERE l.status='published' AND o.status='active'${listingFilter}
          UNION ALL
          SELECT b.id::text, b.asset_code || '/' || b.fiat_code, UPPER(b.side),
                 b.price::text, b.fiat_code, b.quantity::text, b.created_at,
                 'TradeMate P2P'::text, 'P2P'::text
          FROM p2p_public_book b WHERE TRUE${p2pFilter}
        ) activity ORDER BY occurred_at DESC LIMIT $1`, values);
      return { view, source: 'TradeMate published listings and open P2P orders', as_of: new Date().toISOString(), data: result.rows };
    }
    const values: unknown[] = [limit];
    const listingFilter = category === 'b2b' ? " AND listing_type='b2b'" : category === 'services' ? " AND listing_type='service'" : category === 'p2p' ? ' AND 1=0' : '';
    const p2pFilter = category === 'p2p' || category === 'all' ? '' : ' AND 1=0';
    const result = await databasePool.query(
      `SELECT * FROM (
        SELECT transaction_reference::text AS reference, listing_title AS instrument, side,
               total_minor_units::text AS price, currency_code AS currency, quantity::text AS quantity,
               completed_at AS occurred_at, 'TradeMate marketplace'::text AS source,
               CASE WHEN listing_type='service' THEN 'Services' ELSE 'B2B' END AS market
        FROM marketplace_public_completed_trades WHERE TRUE${listingFilter}
        UNION ALL
        SELECT trade_reference::text, asset_code || '/' || fiat_code, side,
               fiat_total::text, fiat_code, quantity::text, completed_at,
               'TradeMate P2P'::text, 'P2P'::text
        FROM p2p_public_completed_trades WHERE TRUE${p2pFilter}
      ) activity ORDER BY occurred_at DESC LIMIT $1`, values);
    return { view, source: 'TradeMate confirmed marketplace and completed P2P transactions', as_of: new Date().toISOString(), data: result.rows };
  }

  @Get()
  async completed(@Query('type') type?: string, @Query('currency') currency?: string, @Query('limit') limitValue?: string) {
    parseBody(marketCompletedQuerySchema, { type, currency, limit: limitValue });
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const limit = limitValue === undefined ? 50 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be between 1 and 100.');
    if (type && !['b2b', 'service'].includes(type)) throw new BadRequestException('type must be service or b2b.');
    if (currency && !/^[A-Za-z]{3}$/.test(currency)) throw new BadRequestException('currency must be a three-letter code.');
    const values: unknown[] = [];
    const conditions = ['1=1'];
    if (type) { values.push(type); conditions.push(`listing_type = ${values.length}`); }
    if (currency) { values.push(currency.toUpperCase()); conditions.push(`currency_code = ${values.length}`); }
    values.push(limit);
    const result = await databasePool.query(
      `SELECT transaction_reference, listing_id, listing_title, listing_type, quantity,
              unit_price_minor_units, total_minor_units, currency_code, side, completed_at
       FROM marketplace_public_completed_trades
       WHERE ${conditions.join(' AND ')}
       ORDER BY completed_at DESC, transaction_reference, side
       LIMIT ${values.length}`, values,
    );
    return { source: 'TradeMate confirmed marketplace transactions', as_of: new Date().toISOString(), data: result.rows };
  }

}

@Controller('p2p')
class P2PMarketController {
  private async writeP2PAudit(client: PoolClient, actorId: string, eventType: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
    await client.query(
      'INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [actorId, eventType, entityType, entityId, JSON.stringify(metadata)],
    );
  }

  private filters(asset?: string, fiat?: string, limit?: string) {
    const assetCode = (asset || 'USDT').trim().toUpperCase();
    const fiatCode = (fiat || 'NGN').trim().toUpperCase();
    const pageSize = limit === undefined ? 50 : Number(limit);
    if (!/^[A-Z0-9]{2,16}$/.test(assetCode)) throw new BadRequestException('Invalid asset code.');
    if (!/^[A-Z]{3}$/.test(fiatCode)) throw new BadRequestException('Invalid fiat currency code.');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new BadRequestException('limit must be between 1 and 100.');
    return { assetCode, fiatCode, pageSize };
  }

  @Get('book')
  async book(@Query('asset') asset?: string, @Query('fiat') fiat?: string, @Query('side') side?: string, @Query('limit') limit?: string) {
    parseBody(p2pMarketQuerySchema, { asset, fiat, side, limit });
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const { assetCode, fiatCode, pageSize } = this.filters(asset, fiat, limit);
    if (side && !['buy', 'sell'].includes(side.toLowerCase())) throw new BadRequestException('side must be buy or sell.');
    const values: unknown[] = [assetCode, fiatCode];
    let sideClause = '';
    if (side) { values.push(side.toLowerCase()); sideClause = ' AND side = $3'; }
    values.push(pageSize);
    const result = await databasePool.query(
      `SELECT id, side, asset_code, fiat_code, price::text, quantity::text,
              min_fiat_amount::text, max_fiat_amount::text, payment_methods, created_at, updated_at
       FROM p2p_public_book WHERE asset_code = $1 AND fiat_code = $2${sideClause}
       ORDER BY CASE WHEN side = 'buy' THEN price END DESC,
                CASE WHEN side = 'sell' THEN price END ASC, created_at DESC
       LIMIT $${values.length}`, values,
    );
    return { source: 'TradeMate P2P orders', as_of: new Date().toISOString(), data: result.rows };
  }

  @Get('trades')
  async trades(@Query('asset') asset?: string, @Query('fiat') fiat?: string, @Query('limit') limit?: string) {
    parseBody(p2pMarketQuerySchema, { asset, fiat, limit });
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const { assetCode, fiatCode, pageSize } = this.filters(asset, fiat, limit);
    const result = await databasePool.query(
      `SELECT trade_reference, side, asset_code, fiat_code, price::text, quantity::text,
              fiat_total::text, completed_at
       FROM p2p_public_completed_trades
       WHERE asset_code = $1 AND fiat_code = $2
       ORDER BY completed_at DESC, trade_reference, side
       LIMIT $3`, [assetCode, fiatCode, pageSize],
    );
    return { source: 'TradeMate completed P2P ledger', as_of: new Date().toISOString(), data: result.rows };
  }
  private async authenticatedUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired.');
    return result.rows[0].id as string;
  }

  @Post('ads')
  async createAd(@Req() request: Request, @Body() body: unknown) {
    const input = parseBody(p2pAdBodySchema, body);
    const userId = await this.authenticatedUser(request);
    const side = String(input?.side || '').toLowerCase(), asset = String(input?.asset || '').trim().toUpperCase(), fiat = String(input?.fiat || '').trim().toUpperCase();
    let priceUnits: bigint, quantityUnits: bigint, minCents: bigint, maxCents: bigint;
    try {
      priceUnits = decimalToUnits(input.price, 10, 'Price');
      quantityUnits = decimalToUnits(input.quantity, 12, 'Quantity');
      minCents = decimalToUnits(input.minFiatAmount ?? '0', 2, 'Minimum fiat amount');
      maxCents = input.maxFiatAmount === undefined ? productToFiatCents(priceUnits, quantityUnits) : decimalToUnits(input.maxFiatAmount, 2, 'Maximum fiat amount');
    } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Enter valid P2P amounts.'); }
    const methods = Array.isArray(input?.paymentMethods) ? input.paymentMethods.map((v: unknown) => String(v).trim()).filter(Boolean) : [];
    if (!['buy','sell'].includes(side) || !/^[A-Z0-9]{2,16}$/.test(asset) || !/^[A-Z]{3}$/.test(fiat)) throw new BadRequestException('Choose a valid side, asset and fiat currency.');
    const totalCents = productToFiatCents(priceUnits, quantityUnits);
    if (priceUnits <= 0n || quantityUnits <= 0n || minCents < 0n || maxCents < minCents || maxCents <= 0n || maxCents > totalCents) throw new BadRequestException('Enter valid price, quantity and fiat limits.');
    if (methods.length > 10 || methods.some((v: string) => v.length > 60)) throw new BadRequestException('Invalid payment methods.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('INSERT INTO p2p_orders (user_id,side,asset_code,fiat_code,price,quantity,remaining_quantity,min_fiat_amount,max_fiat_amount,payment_methods) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9::jsonb) RETURNING id,side,asset_code,fiat_code,price::text,quantity::text,remaining_quantity::text,min_fiat_amount::text,max_fiat_amount::text,payment_methods,status,created_at', [userId,side,asset,fiat,unitsToDecimal(priceUnits,10),unitsToDecimal(quantityUnits,12),unitsToDecimal(minCents,2),unitsToDecimal(maxCents,2),JSON.stringify(methods)]);
      await this.writeP2PAudit(client, userId, 'p2p.ad_created', 'p2p_ad', result.rows[0].id, { side, asset_code: asset, fiat_code: fiat, price: unitsToDecimal(priceUnits,10), quantity: unitsToDecimal(quantityUnits,12) });
      await client.query('COMMIT');
      return { ad: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('my-ads')
  async myAds(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query('SELECT id,side,asset_code,fiat_code,price::text,quantity::text,remaining_quantity::text,min_fiat_amount::text,max_fiat_amount::text,payment_methods,status,created_at,updated_at FROM p2p_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[userId]);
    return { data: result.rows };
  }

  @Delete('ads/:id')
  async cancelAd(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.authenticatedUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query("UPDATE p2p_orders SET status='cancelled',updated_at=now() WHERE id=$1 AND user_id=$2 AND status IN ('open','partially_filled') RETURNING id",[id,userId]);
      if (!result.rowCount) throw new NotFoundException('Open advertisement not found.');
      await this.writeP2PAudit(client, userId, 'p2p.ad_cancelled', 'p2p_ad', id);
      await client.query('COMMIT');
      return { message: 'Advertisement cancelled.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('orders')
  async placeOrder(@Req() request: Request, @Body() body: unknown) {
    const input = parseBody(p2pOrderBodySchema, body);
    const userId = await this.authenticatedUser(request), adId = String(input?.adId || '');
    let fiatCents: bigint;
    try { fiatCents = decimalToUnits(input.fiatAmount, 2, 'Fiat amount'); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Enter a valid fiat amount.'); }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adId) || fiatCents <= 0n) throw new BadRequestException('Choose an offer and enter a valid fiat amount.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query('SELECT id,user_id,side,asset_code,fiat_code,price,remaining_quantity,min_fiat_amount,max_fiat_amount,status FROM p2p_orders WHERE id=$1 FOR UPDATE',[adId]);
      if (!locked.rowCount) throw new NotFoundException('Advertisement not found.');
      const ad = locked.rows[0];
      if (ad.user_id === userId) throw new BadRequestException('You cannot order from your own advertisement.');
      if (!['open','partially_filled'].includes(ad.status)) throw new ConflictException('Advertisement is no longer available.');
      const priceUnits = decimalToUnits(String(ad.price), 10, 'Stored price');
      const remainingUnits = decimalToUnits(String(ad.remaining_quantity), 12, 'Stored remaining quantity');
      const minCents = decimalToUnits(String(ad.min_fiat_amount), 2, 'Stored minimum fiat amount');
      const maxCents = decimalToUnits(String(ad.max_fiat_amount), 2, 'Stored maximum fiat amount');
      if (fiatCents < minCents || fiatCents > maxCents) throw new BadRequestException('Amount is outside the advertisement limits.');
      const quantityUnits = fiatCentsToQuantityUnits(fiatCents, priceUnits);
      if (quantityUnits <= 0n || quantityUnits > remainingUnits) throw new ConflictException('Insufficient quantity remains at the supported asset precision.');
      if (productToFiatCents(priceUnits, quantityUnits) !== fiatCents) throw new BadRequestException('This fiat amount cannot be represented exactly at the supported asset precision.');
      const buyer = ad.side === 'sell' ? userId : ad.user_id, seller = ad.side === 'sell' ? ad.user_id : userId;
      const trade = await client.query("INSERT INTO p2p_trades (order_id,buyer_user_id,seller_user_id,asset_code,fiat_code,price,quantity,fiat_total,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING id,order_id,asset_code,fiat_code,price::text,quantity::text,fiat_total::text,status,created_at",[adId,buyer,seller,ad.asset_code,ad.fiat_code,ad.price,unitsToDecimal(quantityUnits,12),unitsToDecimal(fiatCents,2)]);
      const remaining = remainingUnits - quantityUnits;
      await client.query("UPDATE p2p_orders SET remaining_quantity=$1::numeric,status=CASE WHEN $1::numeric<=0 THEN 'filled' ELSE 'partially_filled' END,updated_at=now() WHERE id=$2",[unitsToDecimal(remaining,12),adId]);
      await this.writeP2PAudit(client, userId, 'p2p.order_created', 'p2p_trade', trade.rows[0].id, { advertisement_id: adId, asset_code: ad.asset_code, fiat_code: ad.fiat_code, quantity: unitsToDecimal(quantityUnits,12), fiat_total: unitsToDecimal(fiatCents,2) });
      await client.query('COMMIT');
      return { order: trade.rows[0], message: 'Order created. TradeMate does not hold funds or provide escrow.' };
    } catch (error) { await client.query('ROLLBACK').catch(()=>undefined); throw error; } finally { client.release(); }
  }

  @Get('my-orders')
  async myOrders(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query('SELECT id,order_id,buyer_user_id,seller_user_id,asset_code,fiat_code,price::text,quantity::text,fiat_total::text,status,buyer_payment_sent_at,seller_payment_confirmed_at,payment_reference,dispute_reason,created_at,updated_at FROM p2p_trades WHERE buyer_user_id=$1 OR seller_user_id=$1 ORDER BY created_at DESC LIMIT 100',[userId]);
    return { data: result.rows };
  }

  @Post('orders/:id/payment-sent')
  async paymentSent(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(p2pPaymentSentBodySchema, body);
    const userId = await this.authenticatedUser(request), ref = typeof input?.reference === 'string' ? input.reference.trim() : '';
    if (ref.length > 160) throw new BadRequestException('Reference is too long.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query("UPDATE p2p_trades SET buyer_payment_sent_at=now(),payment_reference=NULLIF($1,''),updated_at=now() WHERE id=$2 AND buyer_user_id=$3 AND status='pending' AND buyer_payment_sent_at IS NULL RETURNING id,status,buyer_payment_sent_at",[ref,id,userId]);
      if (!result.rowCount) throw new ConflictException('Order cannot be marked as paid.');
      await this.writeP2PAudit(client, userId, 'p2p.payment_marked_sent', 'p2p_trade', id, { reference_provided: Boolean(ref) });
      await client.query('COMMIT');
      return { order: result.rows[0], message: 'Seller confirmation is still required.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('orders/:id/confirm-receipt')
  async confirmReceipt(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.authenticatedUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT t.id, t.order_id, t.buyer_user_id, t.seller_user_id, t.asset_code, t.fiat_code,
                t.price::text, t.quantity::text, t.fiat_total::text, t.buyer_payment_sent_at, t.seller_payment_confirmed_at, t.completed_at,
                b.display_name AS buyer_name, s.display_name AS seller_name
         FROM p2p_trades t JOIN users b ON b.id = t.buyer_user_id JOIN users s ON s.id = t.seller_user_id
         WHERE t.id = $1 AND t.seller_user_id = $2 AND t.status = 'pending'
           AND t.buyer_payment_sent_at IS NOT NULL AND t.seller_payment_confirmed_at IS NULL
         FOR UPDATE OF t`,
        [id, userId],
      );
      if (!locked.rowCount) throw new ConflictException('Buyer must first mark payment sent; order must still be pending.');
      const result = await client.query("UPDATE p2p_trades SET seller_payment_confirmed_at=now(),status='completed',completed_at=now(),updated_at=now() WHERE id=$1 AND seller_user_id=$2 AND status='pending' AND buyer_payment_sent_at IS NOT NULL AND seller_payment_confirmed_at IS NULL RETURNING id,status,completed_at",[id,userId]);
      if (!result.rowCount) throw new ConflictException('Trade state changed; refresh and try again.');
      const receiptTrade = { ...locked.rows[0], completed_at: result.rows[0].completed_at };
      await saveP2PTradeReceiptVaultDocuments(client, receiptTrade);
      await this.writeP2PAudit(client, userId, 'p2p.trade_completed', 'p2p_trade', id, { receipt_documents_created: 2 });
      await client.query('COMMIT');
      return { order: result.rows[0], receipt: { document_type: 'receipt', visibility: 'private', saved_to_both_portfolios: true } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('orders/:id/cancel')
  async cancelOrder(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.authenticatedUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid order UUID.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query("SELECT id,order_id,buyer_user_id,status,buyer_payment_sent_at,quantity::text FROM p2p_trades WHERE id=$1 FOR UPDATE",[id]);
      if (!locked.rowCount) throw new NotFoundException('P2P order not found.');
      const trade = locked.rows[0];
      if (trade.buyer_user_id !== userId) throw new ForbiddenException('Only the buyer can cancel this unpaid order.');
      if (trade.status !== 'pending' || trade.buyer_payment_sent_at) throw new ConflictException('An order cannot be cancelled after payment is marked sent or a dispute is opened.');
      const ad = await client.query('SELECT id,quantity::text AS quantity,remaining_quantity::text AS remaining_quantity,status FROM p2p_orders WHERE id=$1 FOR UPDATE',[trade.order_id]);
      if (!ad.rowCount) throw new NotFoundException('Original advertisement not found.');
      const restored = decimalToUnits(String(ad.rows[0].remaining_quantity),12,'Stored remaining quantity') + decimalToUnits(String(trade.quantity),12,'Trade quantity');
      const total = decimalToUnits(String(ad.rows[0].quantity),12,'Stored total quantity');
      if (restored > total) throw new ConflictException('Reserved quantity could not be safely restored.');
      await client.query("UPDATE p2p_orders SET remaining_quantity=$1::numeric,status=CASE WHEN status IN ('cancelled','expired') THEN status WHEN $1::numeric >= quantity THEN 'open' ELSE 'partially_filled' END,updated_at=now() WHERE id=$2",[unitsToDecimal(restored,12),trade.order_id]);
      const cancelled = await client.query("UPDATE p2p_trades SET status='cancelled',cancelled_by=$1,updated_at=now() WHERE id=$2 AND status='pending' AND buyer_payment_sent_at IS NULL RETURNING id,status,updated_at",[userId,id]);
      if (!cancelled.rowCount) throw new ConflictException('Order state changed; refresh and try again.');
      await this.writeP2PAudit(client, userId, 'p2p.order_cancelled', 'p2p_trade', id, { advertisement_id: trade.order_id, quantity: String(trade.quantity) });
      await client.query('COMMIT');
      return { order: cancelled.rows[0], message: 'Order cancelled. The reserved advertisement quantity was restored where the offer remains active.' };
    } catch (error) { await client.query('ROLLBACK').catch(()=>undefined); throw error; }
    finally { client.release(); }
  }

  @Post('orders/:id/dispute')
  async dispute(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(p2pDisputeBodySchema, body);
    const userId = await this.authenticatedUser(request), reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid order UUID.');
    if (reason.length < 5 || reason.length > 1000) throw new BadRequestException('Dispute reason must be 5 to 1,000 characters.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query("UPDATE p2p_trades SET status='disputed',dispute_reason=$1,updated_at=now() WHERE id=$2 AND (buyer_user_id=$3 OR seller_user_id=$3) AND status='pending' AND buyer_payment_sent_at IS NOT NULL RETURNING id,status,dispute_reason",[reason,id,userId]);
      if (!result.rowCount) throw new ConflictException('A dispute can only be opened by a participant after the buyer marks payment sent.');
      await this.writeP2PAudit(client, userId, 'p2p.dispute_opened', 'p2p_trade', id, { reason_length: reason.length });
      await client.query('COMMIT');
      return { order: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}


@Controller('profiles')
class PublicProfilesController {
  private async currentUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  @Get(':id')
  async getProfile(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const viewerId = await this.currentUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid profile id.');
    const result = await databasePool!.query(
      `SELECT u.id, u.display_name, p.bio, p.instagram_username, p.x_username, p.website_url,
              p.profile_photo_data, p.cover_photo_data, p.highlights,
              (SELECT count(*)::int FROM feed_posts fp WHERE fp.author_user_id = u.id AND fp.status = 'published') AS post_count,
              (SELECT count(*)::int FROM user_follows f WHERE f.followed_user_id = u.id) AS follower_count,
              (SELECT count(*)::int FROM user_follows f WHERE f.follower_user_id = u.id) AS following_count,
              EXISTS(SELECT 1 FROM user_follows f WHERE f.follower_user_id = $2 AND f.followed_user_id = u.id) AS is_following
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1 AND u.status = 'active' LIMIT 1`,
      [id, viewerId],
    );
    if (!result.rowCount) throw new NotFoundException('Profile not found.');
    const p = result.rows[0];
    return { profile: { ...p, bio: p.bio || '', instagram_username: p.instagram_username || '', x_username: p.x_username || '', website_url: p.website_url || '', profile_photo_data: p.profile_photo_data || '', cover_photo_data: p.cover_photo_data || '', highlights: p.highlights || [] } };
  }

  @Patch('me')
  async updateMyProfile(@Req() request: Request, @Body() body: { bio?: string; instagramUsername?: string; xUsername?: string; websiteUrl?: string; profilePhotoData?: string; coverPhotoData?: string; highlights?: unknown[] }) {
    parseBody(publicProfileBodySchema, body);
    const userId = await this.currentUser(request);
    const bio = typeof body?.bio === 'string' ? body.bio.trim() : '';
    const instagram = typeof body?.instagramUsername === 'string' ? body.instagramUsername.trim() : '';
    const x = typeof body?.xUsername === 'string' ? body.xUsername.trim() : '';
    const website = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim() : '';
    const photo = typeof body?.profilePhotoData === 'string' ? body.profilePhotoData : '';
    const cover = typeof body?.coverPhotoData === 'string' ? body.coverPhotoData : '';
    const highlights = Array.isArray(body?.highlights) ? body.highlights : [];
    if (bio.length > 160 || instagram.length > 30 || x.length > 15 || website.length > 2048) throw new BadRequestException('One or more profile fields exceed their allowed length.');
    if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) throw new BadRequestException('Enter a valid Instagram username.');
    if (x && !/^[A-Za-z0-9_]{1,15}$/.test(x)) throw new BadRequestException('Enter a valid X username.');
    if (website && (!/^https:\/\//i.test(website) || website.length > 2048)) throw new BadRequestException('Enter a valid HTTPS website URL.');
    const validImage = (value: string) => !value || !!decodeProfileImageDataUrl(value);
    if (!validImage(photo) || !validImage(cover)) throw new BadRequestException('Profile images must be JPEG, PNG or WebP and smaller than 650 KB each.');
    if (highlights.length > 12 || JSON.stringify(highlights).length > 200000 || highlights.some((h) => !h || typeof h !== 'object' || !isRecord(h) || typeof h.id !== 'string' || typeof h.title !== 'string' || h.title.length > 20 || typeof h.img !== 'string' || h.img.length > 700000)) {
      throw new BadRequestException('Highlights are invalid or exceed the profile limits.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO user_profiles (user_id, username, bio, instagram_username, x_username, website_url, profile_photo_data, cover_photo_data, highlights)
         VALUES ($1, 'tm_' || left(replace($1::uuid::text, '-', ''), 21), $2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET bio=EXCLUDED.bio, instagram_username=EXCLUDED.instagram_username,
           x_username=EXCLUDED.x_username, website_url=EXCLUDED.website_url, profile_photo_data=EXCLUDED.profile_photo_data,
           cover_photo_data=EXCLUDED.cover_photo_data, highlights=EXCLUDED.highlights, updated_at=now()
         RETURNING bio, instagram_username, x_username, website_url, profile_photo_data, cover_photo_data, highlights`,
        [userId, bio, instagram, x, website, photo, cover, JSON.stringify(highlights)],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'profile.public_details_updated', 'user', $1, '{}'::jsonb)",
        [userId],
      );
      await client.query('COMMIT');
      return { profile: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post(':id/follow')
  async follow(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid profile id.');
    if (id === userId) throw new BadRequestException('You cannot follow your own profile.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const exists = await client.query("SELECT 1 FROM users WHERE id=$1 AND status='active' FOR SHARE", [id]);
      if (!exists.rowCount) throw new NotFoundException('Profile not found.');
      const result = await client.query(
        'INSERT INTO user_follows (follower_user_id, followed_user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING followed_user_id',
        [userId, id],
      );
      if (result.rowCount) await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'profile.followed', 'user', $2, '{}'::jsonb)",
        [userId, id],
      );
      await client.query('COMMIT');
      return { following: true };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Delete(':id/follow')
  async unfollow(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid profile id.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const removed = await client.query(
        'DELETE FROM user_follows WHERE follower_user_id=$1 AND followed_user_id=$2 RETURNING followed_user_id',
        [userId, id],
      );
      if (removed.rowCount) await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'profile.unfollowed', 'user', $2, '{}'::jsonb)",
        [userId, id],
      );
      await client.query('COMMIT');
      return { following: false };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

const reviewerKeyId = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 12);

@Controller('feed')
class CommunityFeedController {
  private async currentUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  private reviewKey(request: Request): string {
    const expected = process.env.TRADEMATE_REVIEW_API_KEY || '';
    const supplied = request.header('x-review-key') || '';
    const a = Buffer.from(expected), b = Buffer.from(supplied);
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Feed moderation access is not authorized.');
    }
    return reviewerKeyId(expected);
  }

  @Get('posts')
  async posts(@Query('type') type?: string, @Query('limit') rawLimit?: string) {
    parseBody(feedPostsQuerySchema, { type, limit: rawLimit });
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const normalized = type === 'Posts' || type === 'post' ? 'post'
      : type === 'Feedback' || type === 'feedback' ? 'feedback'
      : type === 'Announcements' || type === 'announcement' ? 'announcement' : null;
    const limit = Math.min(50, Math.max(1, Number.parseInt(rawLimit || '30', 10) || 30));
    const result = await databasePool.query(
      `SELECT p.id, p.author_user_id, p.post_type, p.title, p.body, p.pinned, p.created_at,
              COALESCE(u.display_name, 'TradeMate Team') AS author_name,
              (SELECT count(*)::int FROM feed_comments c WHERE c.post_id = p.id AND c.status = 'published') AS comment_count,
              (SELECT count(*)::int FROM feed_post_reactions r WHERE r.post_id = p.id) AS reaction_count,
              (SELECT count(*)::int FROM feed_post_reshares rs WHERE rs.post_id = p.id) AS reshare_count,
              COALESCE((SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'content_type', a.content_type, 'byte_size', a.byte_size) ORDER BY a.created_at)
                        FROM feed_attachments a WHERE a.post_id = p.id), '[]'::json) AS attachments
       FROM feed_posts p LEFT JOIN users u ON u.id = p.author_user_id
       WHERE p.status = 'published' AND ($1::text IS NULL OR p.post_type = $1)
       ORDER BY p.pinned DESC, p.created_at DESC LIMIT $2`,
      [normalized, limit],
    );
    return { posts: result.rows };
  }

  @Post('posts')
  async createPost(@Req() request: Request, @Body() body: { type?: string; title?: string; body?: string; attachments?: Array<{ name?: string; type?: string; data?: string }> }) {
    parseBody(feedPostBodySchema, body);
    const userId = await this.currentUser(request);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (title.length > 140) throw new BadRequestException('Post titles must be 140 characters or fewer.');
    if (content.length < 1 || content.length > 5000) throw new BadRequestException('Posts must be between 1 and 5,000 characters.');
    const type = body?.type === 'feedback' ? 'feedback' : body?.type === 'post' ? 'post' : null;
    if (!type) throw new BadRequestException('Choose post or feedback. Announcements are published by moderators.');
    const files = Array.isArray(body?.attachments) ? body.attachments : [];
    if (files.length > 4) throw new BadRequestException('Attach up to 4 files per post.');
    const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']);
    const prepared = files.map((file) => {
      const name = typeof file?.name === 'string' ? file.name.trim().slice(0, 180) : '';
      const mime = typeof file?.type === 'string' ? file.type.toLowerCase() : '';
      const rawData = typeof file?.data === 'string' ? file.data : '';
      const dataUrl = rawData.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/);
      const encoded = dataUrl ? dataUrl[2] : rawData;
      const validBase64 = !!encoded && encoded.length % 4 === 0
        && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded);
      if (!name || !allowed.has(mime) || !validBase64 || (dataUrl && dataUrl[1].toLowerCase() !== mime)) {
        throw new BadRequestException('One of the attachments is invalid or unsupported.');
      }
      const bytes = Buffer.from(encoded, 'base64');
      if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== encoded) {
        throw new BadRequestException('Each attachment must be valid and 5 MB or smaller.');
      }
      if (!hasMatchingUploadSignature(mime, bytes)) {
        throw new BadRequestException('The attachment content does not match its declared file type.');
      }
      return { name, mime, bytes };
    });
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO feed_posts (author_user_id, post_type, title, body) VALUES ($1, $2, $3, $4)
         RETURNING id, post_type, title, body, pinned, created_at`,
        [userId, type, title, content],
      );
      for (const file of prepared) await client.query(
        'INSERT INTO feed_attachments (post_id, file_name, content_type, byte_size, content) VALUES ($1, $2, $3, $4, $5)',
        [result.rows[0].id, file.name, file.mime, file.bytes.length, file.bytes],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'feed.post.created', 'feed_post', $2, $3::jsonb)",
        [userId, result.rows[0].id, JSON.stringify({ post_type: type, attachment_count: prepared.length })],
      );
      await client.query('COMMIT');
      return { post: { ...result.rows[0], author_name: 'You', comment_count: 0, attachments: prepared.map((f) => ({ file_name: f.name, content_type: f.mime, byte_size: f.bytes.length })) } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Get('posts/:id/attachments/:attachmentId')
  async attachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Res() response: Response) {
    parseUuidParam(attachmentId);
    parseUuidParam(id);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(id) || !uuid.test(attachmentId)) throw new BadRequestException('Invalid attachment id.');
    const result = await databasePool!.query(
      `SELECT a.file_name, a.content_type, a.content, a.byte_size
       FROM feed_attachments a JOIN feed_posts p ON p.id = a.post_id
       WHERE a.id = $1 AND a.post_id = $2 AND p.status = 'published' LIMIT 1`,
      [attachmentId, id],
    );
    if (!result.rowCount) throw new NotFoundException('Attachment not found.');
    const file = result.rows[0];
    response.setHeader('Content-Type', file.content_type);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Length', String(file.byte_size));
    response.setHeader('Content-Disposition', 'inline; filename="' + String(file.file_name).replace(/[\\"\\r\\n]/g, '_') + '"');
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.send(file.content);
  }

  @Get('posts/:id/comments')
  async comments(@Param('id') id: string) {
    parseUuidParam(id);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid post id.');
    const result = await databasePool.query(
      `SELECT c.id, c.body, c.created_at, u.display_name AS author_name
       FROM feed_comments c JOIN users u ON u.id = c.author_user_id
       JOIN feed_posts p ON p.id = c.post_id
       WHERE c.post_id = $1 AND c.status = 'published' AND p.status = 'published'
       ORDER BY c.created_at ASC LIMIT 200`,
      [id],
    );
    return { comments: result.rows };
  }

  @Post('posts/:id/comments')
  async addComment(@Param('id') id: string, @Req() request: Request, @Body() body: { body?: string }) {
    parseUuidParam(id);
    parseBody(feedCommentBodySchema, body);
    const userId = await this.currentUser(request);
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (content.length < 1 || content.length > 2000) throw new BadRequestException('Comments must be between 1 and 2,000 characters.');
    const result = await databasePool!.query(
      `INSERT INTO feed_comments (post_id, author_user_id, body)
       SELECT p.id, $2, $3 FROM feed_posts p WHERE p.id = $1 AND p.status = 'published'
       RETURNING id, post_id, body, created_at`,
      [id, userId, content],
    );
    if (!result.rowCount) throw new NotFoundException('Published post not found.');
    return { comment: { ...result.rows[0], author_name: 'You' } };
  }

  @Post('posts/:id/reactions')
  async react(@Param('id') id: string, @Req() request: Request, @Body() body: { emoji?: string }) {
    parseUuidParam(id); parseBody(feedReactionBodySchema, body);
    const userId = await this.currentUser(request);
    const found = await databasePool!.query("SELECT id FROM feed_posts WHERE id = $1 AND status = 'published'", [id]);
    if (!found.rowCount) throw new NotFoundException('Published post not found.');
    await databasePool!.query(
      'INSERT INTO feed_post_reactions (post_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT (post_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = now()',
      [id, userId, body.emoji],
    );
    const totals = await databasePool!.query('SELECT count(*)::int AS reaction_count FROM feed_post_reactions WHERE post_id = $1', [id]);
    return { success: true, emoji: body.emoji, reaction_count: totals.rows[0].reaction_count };
  }

  @Delete('posts/:id/reactions')
  async removeReaction(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id); const userId = await this.currentUser(request);
    await databasePool!.query('DELETE FROM feed_post_reactions WHERE post_id = $1 AND user_id = $2', [id, userId]);
    return { success: true };
  }

  @Patch('posts/:id/pin')
  async pinPost(@Param('id') id: string, @Req() request: Request, @Body() body: { pinned?: boolean }) {
    parseUuidParam(id); parseBody(feedPinBodySchema, body);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        "UPDATE feed_posts SET pinned = $3, updated_at = now() WHERE id = $1 AND author_user_id = $2 AND status = 'published' RETURNING id, pinned",
        [id, userId, body.pinned],
      );
      if (!result.rowCount) throw new NotFoundException('Post not found or you are not its owner.');
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'feed.post.pin_changed', 'feed_post', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ pinned: body.pinned })],
      );
      await client.query('COMMIT');
      return { post: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('posts/:id/reshare')
  async reshare(@Param('id') id: string, @Req() request: Request, @Body() body: { note?: string }) {
    parseUuidParam(id); parseBody(feedReshareBodySchema, body);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const original = await client.query("SELECT id FROM feed_posts WHERE id = $1 AND status = 'published' FOR SHARE", [id]);
      if (!original.rowCount) throw new NotFoundException('Published post not found.');
      const saved = await client.query(
        'INSERT INTO feed_post_reshares (post_id, user_id, note) VALUES ($1, $2, $3) ON CONFLICT (post_id, user_id) DO UPDATE SET note = EXCLUDED.note, created_at = now() RETURNING id, post_id, note, created_at',
        [id, userId, body.note || ''],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'feed.post.reshared', 'feed_post', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ reshare_id: saved.rows[0].id })],
      );
      const totals = await client.query('SELECT count(*)::int AS reshare_count FROM feed_post_reshares WHERE post_id = $1', [id]);
      await client.query('COMMIT');
      return { reshare: saved.rows[0], reshare_count: totals.rows[0].reshare_count };
    } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  @Post('reports')
  async report(@Req() request: Request, @Body() body: { postId?: string; commentId?: string; reason?: string }) {
    parseBody(feedReportBodySchema, body);
    const userId = await this.currentUser(request);
    const postId = typeof body?.postId === 'string' ? body.postId : null;
    const commentId = typeof body?.commentId === 'string' ? body.commentId : null;
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!!postId === !!commentId || (postId && !uuid.test(postId)) || (commentId && !uuid.test(commentId))) throw new BadRequestException('Report exactly one valid post or comment.');
    if (reason.length < 3 || reason.length > 1000) throw new BadRequestException('Explain the report in 3 to 1,000 characters.');
    const result = await databasePool!.query(
      `INSERT INTO feed_reports (reporter_user_id, post_id, comment_id, reason)
       VALUES ($1, $2, $3, $4) RETURNING id, status, created_at`,
      [userId, postId, commentId, reason],
    );
    return { report: result.rows[0] };
  }

  @Get('moderation/reports')
  async reportQueue(@Req() request: Request) {
    this.reviewKey(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const result = await databasePool.query(
      `SELECT r.id, r.reason, r.status, r.created_at, r.post_id, r.comment_id,
              reporter.display_name AS reporter_name, p.body AS post_body, c.body AS comment_body
       FROM feed_reports r JOIN users reporter ON reporter.id = r.reporter_user_id
       LEFT JOIN feed_posts p ON p.id = r.post_id LEFT JOIN feed_comments c ON c.id = r.comment_id
       WHERE r.status = 'open' ORDER BY r.created_at ASC LIMIT 100`,
    );
    return { reports: result.rows };
  }

  @Patch('moderation/reports/:id')
  async reviewReport(@Param('id') id: string, @Req() request: Request, @Body() body: { action?: string }) {
    parseUuidParam(id);
    parseBody(feedModerationBodySchema, body);
    const keyId = this.reviewKey(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid report id.');
    if (!['hide', 'dismiss'].includes(body?.action || '')) throw new BadRequestException('Choose hide or dismiss.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query("SELECT * FROM feed_reports WHERE id = $1 AND status = 'open' FOR UPDATE", [id]);
      if (!found.rowCount) throw new NotFoundException('Open report not found.');
      const report = found.rows[0];
      if (body.action === 'hide') {
        if (report.post_id) await client.query("UPDATE feed_posts SET status = 'hidden', updated_at = now() WHERE id = $1", [report.post_id]);
        if (report.comment_id) await client.query("UPDATE feed_comments SET status = 'hidden' WHERE id = $1", [report.comment_id]);
      }
      await client.query("UPDATE feed_reports SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3", [body.action === 'hide' ? 'reviewed' : 'dismissed', keyId, id]);
      await client.query(
        "INSERT INTO audit_events (event_type, entity_type, entity_id, metadata) VALUES ('feed.report.reviewed', 'feed_report', $1, $2::jsonb)",
        [id, JSON.stringify({ action: body.action, reviewer_key_id: keyId })],
      );
      await client.query('COMMIT');
      return { success: true, message: body.action === 'hide' ? 'Reported content hidden.' : 'Report dismissed.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Post('announcements')
  async announce(@Req() request: Request, @Body() body: { body?: string }) {
    parseBody(announcementBodySchema, body);
    const keyId = this.reviewKey(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to publish announcements.');
    const session = await resolvePresentedSessionUser(token);
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const authorUserId = session.rows[0].id as string;
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (content.length < 1 || content.length > 5000) throw new BadRequestException('Announcements must be between 1 and 5,000 characters.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO feed_posts (author_user_id, post_type, body, pinned)
         VALUES ($1, 'announcement', $2, true)
         RETURNING id, post_type, body, pinned, created_at`,
        [authorUserId, content],
      );
      await client.query(
        "INSERT INTO audit_events (event_type, entity_type, entity_id, metadata) VALUES ('feed.announcement.created', 'feed_post', $1, $2::jsonb)",
        [result.rows[0].id, JSON.stringify({ reviewer_key_id: keyId })],
      );
      await client.query('COMMIT');
      return { announcement: result.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

@Controller('moderation')
class ModerationController {
  private authorize(request: Request) {
    const expected = process.env.TRADEMATE_REVIEW_API_KEY || '';
    const supplied = request.header('x-review-key') || '';
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(supplied);
    if (!expected || expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      throw new UnauthorizedException('Moderation access is not authorized.');
    }
    return reviewerKeyId(expected);
  }

  @Get('organizations')
  async organizationQueue(@Req() request: Request) {
    this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const result = await databasePool.query(
      `SELECT o.id, o.name, o.organization_type, o.country_code, o.default_currency, o.status, o.created_at,
              u.email AS owner_email, u.display_name AS owner_name
       FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id AND om.member_role = 'owner'
       JOIN users u ON u.id = om.user_id
       WHERE o.status = 'pending'
       ORDER BY o.created_at ASC LIMIT 100`,
    );
    return { data: result.rows };
  }

  @Post('organizations/:id/review')
  async reviewOrganization(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { decision?: string; note?: string },
  ) {
    parseUuidParam(id);
    parseBody(reviewDecisionBodySchema, body);
    const keyId = this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid organization UUID.');
    if (!['approved', 'rejected'].includes(body?.decision || '')) throw new BadRequestException('decision must be approved or rejected.');
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length > 1000) throw new BadRequestException('Review note must be 1,000 characters or fewer.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        "UPDATE organizations SET status = $1, updated_at = now() WHERE id = $2 AND status = 'pending' RETURNING id, name, status",
        [body.decision === 'approved' ? 'active' : 'suspended', id],
      );
      if (!updated.rowCount) {
        const exists = await client.query('SELECT status FROM organizations WHERE id = $1', [id]);
        if (!exists.rowCount) throw new NotFoundException('Organization not found.');
        throw new ConflictException('Only pending organizations can be reviewed.');
      }
      await client.query(
        'INSERT INTO organization_reviews (organization_id, decision, note, reviewer_key_id) VALUES ($1, $2, $3, $4)',
        [id, body.decision, note, keyId],
      );
      await client.query(
        "UPDATE organization_documents SET review_status = $1, reviewer_note = $2, reviewed_at = now() WHERE organization_id = $3 AND review_status = 'pending'",
        [body.decision === 'approved' ? 'approved' : 'rejected', note || null, id],
      );
      await client.query(
        "INSERT INTO audit_events (organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'organization.reviewed', 'organization', $1, $2::jsonb)",
        [id, JSON.stringify({ decision: body.decision, note })],
      );
      await client.query('COMMIT');
      return { organization: updated.rows[0], message: body.decision === 'approved' ? 'Organization approved.' : 'Organization rejected and suspended.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Get('listings')
  async listingQueue(@Req() request: Request) {
    this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const result = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.division, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.review_submitted_at,
              o.id AS organization_id, o.name AS seller_name, o.status AS organization_status
       FROM listings l JOIN organizations o ON o.id = l.seller_organization_id
       WHERE l.status = 'pending_review'
       ORDER BY l.review_submitted_at ASC NULLS LAST LIMIT 100`,
    );
    return { data: result.rows };
  }

  @Post('listings/:id/review')
  async reviewListing(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { decision?: string; note?: string },
  ) {
    parseUuidParam(id);
    parseBody(reviewDecisionBodySchema, body);
    const keyId = this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid listing UUID.');
    if (!['approved', 'rejected'].includes(body?.decision || '')) throw new BadRequestException('decision must be approved or rejected.');
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length > 1000) throw new BadRequestException('Review note must be 1,000 characters or fewer.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE listings l
         SET status = CASE WHEN $1 = 'approved' THEN 'published' ELSE 'rejected' END,
             reviewed_at = now(), review_note = $2, updated_at = now()
         WHERE l.id = $3 AND l.status = 'pending_review'
           AND ($1 <> 'approved' OR EXISTS (SELECT 1 FROM organizations o WHERE o.id = l.seller_organization_id AND o.status = 'active'))
         RETURNING l.id, l.title, l.status, l.reviewed_at, l.review_note`,
        [body.decision, note, id],
      );
      if (!result.rowCount) {
        const existing = await client.query(
          "SELECT l.status, o.status AS organization_status FROM listings l JOIN organizations o ON o.id = l.seller_organization_id WHERE l.id = $1",
          [id],
        );
        if (!existing.rowCount) throw new NotFoundException('Offer not found.');
        if (existing.rows[0].status !== 'pending_review') throw new ConflictException('Only offers pending review can be reviewed.');
        throw new ConflictException('Approve the seller organization before approving its offers.');
      }
      await client.query(
        "INSERT INTO audit_events (organization_id, event_type, entity_type, entity_id, metadata) SELECT l.seller_organization_id, 'listing.reviewed', 'listing', l.id, $2::jsonb FROM listings l WHERE l.id = $1",
        [id, JSON.stringify({ decision: body.decision, note, reviewer_key_id: keyId })],
      );
      await client.query('COMMIT');
      return { listing: result.rows[0], message: body.decision === 'approved' ? 'Offer approved and published.' : 'Offer rejected.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
}




@Controller('sports-transfer')
class SportsTransferIdentityController {
  private async currentUser(request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  @Get('profiles/mine')
  async myProfiles(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT id, sport, display_name, biography, primary_position, country_code,
              visibility, verification_status, created_at, updated_at
       FROM sports_profiles WHERE user_id = $1 ORDER BY sport ASC`,
      [userId],
    );
    return { profiles: result.rows };
  }

  @Post('profiles')
  async createProfile(@Req() request: Request, @Body() body: unknown) {
    const input = parseBody(sportsProfileCreateBodySchema, body);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO sports_profiles (user_id, sport, display_name, biography, primary_position, country_code)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, sport, display_name, biography, primary_position, country_code,
                     visibility, verification_status, created_at, updated_at`,
          [userId, input.sport, input.displayName, input.biography || '', input.primaryPosition || '', input.countryCode || null],
        );
        await client.query(
          "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.profile.created', 'sports_profile', $2, $3::jsonb)",
          [userId, result.rows[0].id, JSON.stringify({ sport: input.sport })],
        );
        await client.query('COMMIT');
        return { profile: result.rows[0], message: 'Your private Sports Transfer profile has been created.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('You already have a profile for this sport.');
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch('profiles/:id')
  async updateProfile(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(sportsProfileUpdateBodySchema, body);
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `UPDATE sports_profiles
       SET display_name = COALESCE($1, display_name),
           biography = COALESCE($2, biography),
           primary_position = COALESCE($3, primary_position),
           country_code = CASE WHEN $4::boolean THEN $5::char(2) ELSE country_code END,
           updated_at = now()
       WHERE id = $6 AND user_id = $7
       RETURNING id, sport, display_name, biography, primary_position, country_code,
                 visibility, verification_status, created_at, updated_at`,
      [input.displayName ?? null, input.biography ?? null, input.primaryPosition ?? null,
       Object.prototype.hasOwnProperty.call(input, 'countryCode'), input.countryCode ?? null, id, userId],
    );
    if (!result.rowCount) throw new NotFoundException('Sports Transfer profile not found.');
    await databasePool!.query(
      "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.profile.updated', 'sports_profile', $2, $3::jsonb)",
      [userId, id, JSON.stringify({ fields: Object.keys(input) })],
    );
    return { profile: result.rows[0] };
  }

  @Get('profiles/:id/consents')
  async listProfileConsents(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    const owner = await databasePool!.query('SELECT id FROM sports_profiles WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!owner.rowCount) throw new NotFoundException('Sports Transfer profile not found.');
    const result = await databasePool!.query(
      `SELECT c.id, c.granted_to_user_id, c.granted_to_organization_id, c.purpose,
              c.scope, c.status, c.granted_at, c.expires_at, c.revoked_at
       FROM sports_player_consents c
       WHERE c.player_profile_id = $1
       ORDER BY c.created_at DESC LIMIT 100`,
      [id],
    );
    return { consents: result.rows };
  }

  @Post('profiles/:id/consents')
  async grantProfileConsent(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(sportsConsentGrantBodySchema, body);
    const userId = await this.currentUser(request);
    const expiresAt = new Date(input.expiresAt);
    const now = Date.now();
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now || expiresAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Consent must expire within the next 12 months.');
    }
    if (input.targetUserId === userId) throw new BadRequestException('Consent cannot be granted to your own account.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const profile = await client.query(
        'SELECT id, sport FROM sports_profiles WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId],
      );
      if (!profile.rowCount) throw new NotFoundException('Sports Transfer profile not found.');
      if (input.targetUserId) {
        const target = await client.query("SELECT id FROM users WHERE id = $1 AND status = 'active'", [input.targetUserId]);
        if (!target.rowCount) throw new NotFoundException('The consent recipient was not found.');
      } else if (input.targetOrganizationId) {
        const target = await client.query('SELECT id FROM sports_organizations WHERE id = $1', [input.targetOrganizationId]);
        if (!target.rowCount) throw new NotFoundException('The sporting organization was not found.');
      }
      const result = await client.query(
        `INSERT INTO sports_player_consents
           (player_profile_id, granted_by_user_id, granted_to_user_id, granted_to_organization_id,
            purpose, scope, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         RETURNING id, granted_to_user_id, granted_to_organization_id, purpose, scope,
                   status, granted_at, expires_at`,
        [id, userId, input.targetUserId || null, input.targetOrganizationId || null,
         input.purpose, JSON.stringify(input.scope || {}), expiresAt.toISOString()],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.consent.granted', 'sports_player_consent', $2, $3::jsonb)",
        [userId, result.rows[0].id, JSON.stringify({ profile_id: id, purpose: input.purpose, recipient_type: input.targetUserId ? 'user' : 'organization', expires_at: expiresAt.toISOString() })],
      );
      await client.query('COMMIT');
      return { consent: result.rows[0], message: 'Your time-limited consent has been recorded.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('consents/:id/revoke')
  async revokeConsent(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const profile = await client.query(
        `SELECT p.id FROM sports_player_consents c
         JOIN sports_profiles p ON p.id = c.player_profile_id
         WHERE c.id = $1 AND p.user_id = $2
         FOR UPDATE OF p`,
        [id, userId],
      );
      if (!profile.rowCount) throw new NotFoundException('Active consent not found.');
      const result = await client.query(
        `UPDATE sports_player_consents c
         SET status = 'revoked', revoked_at = now()
         WHERE c.id = $1 AND c.player_profile_id = $2
           AND c.status = 'granted' AND c.revoked_at IS NULL
         RETURNING c.id, c.player_profile_id, c.granted_to_user_id,
                   c.granted_to_organization_id, c.purpose, c.status, c.revoked_at`,
        [id, profile.rows[0].id],
      );
      if (!result.rowCount) throw new NotFoundException('Active consent not found.');
      const consent = result.rows[0];
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.consent.revoked', 'sports_player_consent', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ profile_id: consent.player_profile_id, purpose: consent.purpose })],
      );
      if (consent.purpose === 'representative_access') {
        const mandates = await client.query(
          `UPDATE sports_representative_mandates
           SET status = 'revoked', revoked_at = now(), updated_at = now(),
               response_note = 'Underlying representative-access consent was revoked.'
           WHERE player_profile_id = $1 AND status IN ('pending', 'active')
             AND revoked_at IS NULL
             AND (($2::uuid IS NOT NULL AND representative_user_id = $2)
               OR ($3::uuid IS NOT NULL AND representative_organization_id = $3))
           RETURNING id, representative_user_id, representative_organization_id`,
          [consent.player_profile_id, consent.granted_to_user_id, consent.granted_to_organization_id],
        );
        for (const mandate of mandates.rows) {
          await client.query(
            "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.mandate.revoked', 'sports_representative_mandate', $2, $3::jsonb)",
            [userId, mandate.id, JSON.stringify({ profile_id: consent.player_profile_id, consent_id: id, reason: 'consent_revoked' })],
          );
          if (mandate.representative_user_id) {
            await client.query(
              "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'System', 'Sports Transfer mandate revoked', 'The player revoked the consent authorizing this representation mandate. Do not act on their behalf.', 'shield-alert')",
              [mandate.representative_user_id],
            );
          } else {
            await client.query(
              `INSERT INTO user_notifications (user_id, category, title, body, icon)
               SELECT user_id, 'System', 'Sports Transfer mandate revoked',
                      'The player revoked the consent authorizing this organization representation mandate.', 'shield-alert'
               FROM sports_org_memberships
               WHERE sports_organization_id = $1 AND role IN ('owner', 'admin')
                 AND status = 'active'
                 AND (starts_at IS NULL OR starts_at <= now())
                 AND (expires_at IS NULL OR expires_at > now())`,
              [mandate.representative_organization_id],
            );
          }
        }
      }
      await client.query('COMMIT');
      return { consent: { id: consent.id, player_profile_id: consent.player_profile_id, purpose: consent.purpose, status: consent.status, revoked_at: consent.revoked_at }, message: 'Consent has been revoked.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}


@Controller('sports-transfer')
class SportsTransferOrganizationsController {
  private async currentUser(request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  private async managerRole(client: Pool | PoolClient, organizationId: string, userId: string) {
    const result = await client.query(
      `SELECT role FROM sports_org_memberships
       WHERE sports_organization_id = $1 AND user_id = $2 AND status = 'active'
         AND (starts_at IS NULL OR starts_at <= now())
         AND (expires_at IS NULL OR expires_at > now())
       FOR UPDATE`,
      [organizationId, userId],
    );
    if (!result.rowCount || !['owner', 'admin'].includes(result.rows[0].role)) {
      throw new ForbiddenException('Only active sporting-organization owners and admins can manage memberships.');
    }
    return result.rows[0].role as string;
  }

  @Get('organizations/mine')
  async mine(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT o.id, o.entity_type, o.legal_name, o.display_name, o.country_code,
              o.governing_body, o.verification_status, m.role AS member_role,
              m.permission_scope, m.status AS membership_status, m.expires_at,
              o.created_at
       FROM sports_org_memberships m
       JOIN sports_organizations o ON o.id = m.sports_organization_id
       WHERE m.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId],
    );
    return { organizations: result.rows };
  }

  @Post('organizations')
  async createOrganization(@Req() request: Request, @Body() body: unknown) {
    const input = parseBody(sportsOrganizationCreateBodySchema, body);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query(
        `INSERT INTO sports_organizations
           (entity_type, legal_name, display_name, country_code, governing_body, created_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, entity_type, legal_name, display_name, country_code, governing_body,
                   verification_status, created_at`,
        [input.entityType, input.legalName, input.displayName, input.countryCode,
         input.governingBody || '', userId],
      );
      const organization = created.rows[0];
      const membership = await client.query(
        `INSERT INTO sports_org_memberships
           (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at)
         VALUES ($1, $2, 'owner', 'workspace', 'active', $2, now())
         RETURNING id, role, permission_scope, status`,
        [organization.id, userId],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.organization.created', 'sports_organization', $2, $3::jsonb)",
        [userId, organization.id, JSON.stringify({ entity_type: input.entityType, country_code: input.countryCode })],
      );
      await client.query('COMMIT');
      return { organization: { ...organization, membership: membership.rows[0] }, message: 'Your sporting organization has been created and is awaiting verification.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('organizations/:id/members')
  async listMembers(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    await this.managerRole(databasePool!, id, userId);
    const result = await databasePool!.query(
      `SELECT m.id, m.user_id, u.display_name, m.role, m.permission_scope,
              m.status, m.starts_at, m.expires_at, m.created_at
       FROM sports_org_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.sports_organization_id = $1
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at ASC`,
      [id],
    );
    return { members: result.rows };
  }

  @Post('organizations/:id/memberships')
  async inviteMember(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(sportsOrganizationMembershipInviteBodySchema, body);
    const userId = await this.currentUser(request);
    const expiresAt = new Date(input.expiresAt);
    const now = Date.now();
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now || expiresAt.getTime() > now + 30 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Membership invitations must expire within 30 days.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const organization = await client.query('SELECT id FROM sports_organizations WHERE id = $1 FOR UPDATE', [id]);
      if (!organization.rowCount) throw new NotFoundException('Sporting organization not found.');
      const actorRole = await this.managerRole(client, id, userId);
      if (actorRole === 'admin' && input.role === 'admin') {
        throw new ForbiddenException('Only an organization owner can invite another admin.');
      }
      const target = await client.query("SELECT id FROM users WHERE id = $1 AND status = 'active'", [input.userId]);
      if (!target.rowCount) throw new NotFoundException('The invited account was not found.');
      const existing = await client.query(
        `SELECT id, status, expires_at FROM sports_org_memberships
         WHERE sports_organization_id = $1 AND user_id = $2 FOR UPDATE`,
        [id, input.userId],
      );
      let result;
      if (existing.rowCount) {
        const prior = existing.rows[0];
        const expired = prior.expires_at && new Date(prior.expires_at).getTime() <= now;
        if (prior.status !== 'revoked' && !expired) {
          throw new ConflictException('This account already has an active membership or unexpired invitation.');
        }
        result = await client.query(
          `UPDATE sports_org_memberships
           SET role = $1, permission_scope = $2, status = 'invited',
               invited_by_user_id = $3, starts_at = NULL, expires_at = $4, updated_at = now()
           WHERE id = $5
           RETURNING id, user_id, role, permission_scope, status, expires_at, created_at`,
          [input.role, input.permissionScope, userId, expiresAt.toISOString(), prior.id],
        );
      } else {
        result = await client.query(
          `INSERT INTO sports_org_memberships
             (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, expires_at)
           VALUES ($1, $2, $3, $4, 'invited', $5, $6)
           RETURNING id, user_id, role, permission_scope, status, expires_at, created_at`,
          [id, input.userId, input.role, input.permissionScope, userId, expiresAt.toISOString()],
        );
      }
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.organization.member_invited', 'sports_org_membership', $2, $3::jsonb)",
        [userId, result.rows[0].id, JSON.stringify({ sports_organization_id: id, invited_user_id: input.userId, role: input.role, permission_scope: input.permissionScope, expires_at: expiresAt.toISOString() })],
      );
      await client.query(
        "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'System', 'Sporting organization invitation', $2, 'users')",
        [input.userId, 'You have been invited to join a sporting organization as ' + input.role.replace(/_/g, ' ') + '.'],
      );
      await client.query('COMMIT');
      return { membership: result.rows[0], message: 'Membership invitation created.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('This account already has a membership or invitation for the organization.');
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('memberships/:id/accept')
  async acceptInvitation(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE sports_org_memberships
         SET status = 'active', starts_at = now(), updated_at = now()
         WHERE id = $1 AND user_id = $2 AND status = 'invited'
           AND (expires_at IS NULL OR expires_at > now())
         RETURNING id, sports_organization_id, role, permission_scope, status, starts_at, expires_at`,
        [id, userId],
      );
      if (!result.rowCount) throw new NotFoundException('Active membership invitation not found.');
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.organization.invitation_accepted', 'sports_org_membership', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ sports_organization_id: result.rows[0].sports_organization_id })],
      );
      await client.query(
        `INSERT INTO user_notifications (user_id, category, title, body, icon)
         SELECT user_id, 'System', 'New sporting organization member',
                'A new member has accepted an invitation to your sporting organization.', 'users'
         FROM sports_org_memberships
         WHERE sports_organization_id = $1 AND role IN ('owner', 'admin')
           AND status = 'active'
           AND (starts_at IS NULL OR starts_at <= now())
           AND (expires_at IS NULL OR expires_at > now())
           AND user_id <> $2`,
        [result.rows[0].sports_organization_id, userId],
      );
      await client.query('COMMIT');
      return { membership: result.rows[0], message: 'You have joined the sporting organization.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('memberships/:id/revoke')
  async revokeMembership(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const target = await client.query(
        `SELECT id, sports_organization_id, user_id, role, status
         FROM sports_org_memberships WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!target.rowCount || target.rows[0].status === 'revoked') {
        throw new NotFoundException('Active sporting-organization membership not found.');
      }
      const row = target.rows[0];
      const actorRole = await this.managerRole(client, row.sports_organization_id, userId);
      if (row.role === 'owner') throw new ForbiddenException('The organization owner cannot be removed through membership management.');
      if (actorRole === 'admin' && row.role === 'admin' && row.user_id !== userId) {
        throw new ForbiddenException('Admins cannot revoke another admin membership.');
      }
      if (row.status !== 'active' && row.status !== 'invited') {
        throw new NotFoundException('Active sporting-organization membership not found.');
      }
      const revoked = await client.query(
        `UPDATE sports_org_memberships SET status = 'revoked', updated_at = now()
         WHERE id = $1 RETURNING id, sports_organization_id, user_id, role, status`,
        [id],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.organization.membership_revoked', 'sports_org_membership', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ sports_organization_id: row.sports_organization_id, revoked_user_id: row.user_id, role: row.role })],
      );
      if (row.user_id !== userId) {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'System', 'Sporting organization access updated', 'Your membership in a sporting organization has been revoked.', 'users')",
          [row.user_id],
        );
      }
      await client.query('COMMIT');
      return { membership: revoked.rows[0], message: 'Membership has been revoked.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}


@Controller('sports-transfer')
class SportsTransferMandatesController {
  private async currentUser(request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  private async canRespond(client: PoolClient, mandate: Record<string, unknown>, userId: string) {
    if (mandate.representative_user_id) return mandate.representative_user_id === userId;
    const membership = await client.query(
      `SELECT role FROM sports_org_memberships
       WHERE sports_organization_id = $1 AND user_id = $2 AND status = 'active'
         AND role IN ('owner', 'admin')
         AND (starts_at IS NULL OR starts_at <= now())
         AND (expires_at IS NULL OR expires_at > now())
       FOR UPDATE`,
      [mandate.representative_organization_id, userId],
    );
    return Boolean(membership.rowCount);
  }

  @Get('profiles/:id/mandates')
  async listPlayerMandates(@Param('id') id: string, @Req() request: Request) {
    parseUuidParam(id);
    const userId = await this.currentUser(request);
    const owner = await databasePool!.query(
      'SELECT id FROM sports_profiles WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (!owner.rowCount) throw new NotFoundException('Sports Transfer profile not found.');
    const result = await databasePool!.query(
      `SELECT m.id, m.representative_user_id, ru.display_name AS representative_name,
              m.representative_organization_id, ro.display_name AS representative_organization_name,
              m.mandate_type, m.permitted_actions, m.territory_codes, m.competition_ids,
              m.status, m.representative_response, m.response_note, m.responded_at,
              m.starts_at, m.expires_at, m.verified_at, m.created_at,
              CASE WHEN m.status IN ('pending', 'active') AND m.expires_at <= now()
                   THEN 'expired' ELSE m.status END AS effective_status
       FROM sports_representative_mandates m
       LEFT JOIN users ru ON ru.id = m.representative_user_id
       LEFT JOIN sports_organizations ro ON ro.id = m.representative_organization_id
       WHERE m.player_profile_id = $1
       ORDER BY m.created_at DESC LIMIT 100`,
      [id],
    );
    return { mandates: result.rows };
  }

  @Get('mandates/mine')
  async myMandates(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT m.id, m.player_profile_id, p.display_name AS player_display_name, p.sport,
              m.representative_user_id, m.representative_organization_id,
              m.mandate_type, m.permitted_actions, m.territory_codes, m.competition_ids,
              m.status, m.representative_response, m.response_note, m.responded_at,
              m.starts_at, m.expires_at, m.verified_at, m.created_at,
              CASE WHEN m.status IN ('pending', 'active') AND m.expires_at <= now()
                   THEN 'expired' ELSE m.status END AS effective_status
       FROM sports_representative_mandates m
       JOIN sports_profiles p ON p.id = m.player_profile_id
       WHERE m.representative_user_id = $1
          OR EXISTS (
            SELECT 1 FROM sports_org_memberships om
            WHERE om.sports_organization_id = m.representative_organization_id
              AND om.user_id = $1 AND om.status = 'active'
              AND om.role IN ('owner', 'admin')
              AND (om.starts_at IS NULL OR om.starts_at <= now())
              AND (om.expires_at IS NULL OR om.expires_at > now())
          )
       ORDER BY m.created_at DESC LIMIT 100`,
      [userId],
    );
    return { mandates: result.rows };
  }

  @Post('profiles/:id/mandates')
  async createMandate(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(sportsRepresentativeMandateCreateBodySchema, body);
    const userId = await this.currentUser(request);
    const now = Date.now();
    const expiresAt = new Date(input.expiresAt);
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date(now);
    if (!Number.isFinite(expiresAt.getTime()) || !Number.isFinite(startsAt.getTime())
      || startsAt.getTime() < now - 5 * 60 * 1000
      || expiresAt.getTime() <= startsAt.getTime()
      || expiresAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Mandates must start now or later and expire within the next 12 months.');
    }

    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const profile = await client.query(
        'SELECT id, user_id, sport FROM sports_profiles WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId],
      );
      if (!profile.rowCount) throw new NotFoundException('Sports Transfer profile not found.');

      if (input.representativeUserId === userId) {
        throw new BadRequestException('You cannot appoint yourself as your own representative.');
      }

      if (input.representativeUserId) {
        const target = await client.query(
          "SELECT id FROM users WHERE id = $1 AND status = 'active'",
          [input.representativeUserId],
        );
        if (!target.rowCount) throw new NotFoundException('The representative account was not found.');
      } else {
        const target = await client.query(
          'SELECT id FROM sports_organizations WHERE id = $1',
          [input.representativeOrganizationId],
        );
        if (!target.rowCount) throw new NotFoundException('The representative organization was not found.');
      }

      const consent = await client.query(
        `SELECT id, scope FROM sports_player_consents
         WHERE player_profile_id = $1 AND granted_by_user_id = $2
           AND purpose = 'representative_access' AND status = 'granted'
           AND expires_at > now()
           AND ((granted_to_user_id = $3 AND $3::uuid IS NOT NULL)
             OR (granted_to_organization_id = $4 AND $4::uuid IS NOT NULL))
         ORDER BY granted_at DESC LIMIT 1 FOR UPDATE`,
        [id, userId, input.representativeUserId || null, input.representativeOrganizationId || null],
      );
      if (!consent.rowCount) {
        throw new ForbiddenException('Grant current representative-access consent to this exact person or organization before creating a mandate.');
      }
      const consentScope = consent.rows[0].scope || {};
      const allowedTerritories = Array.isArray(consentScope.territoryCodes) ? consentScope.territoryCodes : [];
      const allowedCompetitions = Array.isArray(consentScope.competitionIds) ? consentScope.competitionIds : [];
      if ((input.territoryCodes || []).some((code: string) => !allowedTerritories.includes(code))) {
        throw new ForbiddenException('The mandate territory exceeds the territory in your representative-access consent.');
      }
      if ((input.competitionIds || []).some((competitionId: string) => !allowedCompetitions.includes(competitionId))) {
        throw new ForbiddenException('The mandate competition scope exceeds your representative-access consent.');
      }

      const duplicate = await client.query(
        `SELECT id FROM sports_representative_mandates
         WHERE player_profile_id = $1
           AND status IN ('pending', 'active') AND expires_at > now()
           AND ((representative_user_id = $2 AND $2::uuid IS NOT NULL)
             OR (representative_organization_id = $3 AND $3::uuid IS NOT NULL))
         LIMIT 1 FOR UPDATE`,
        [id, input.representativeUserId || null, input.representativeOrganizationId || null],
      );
      if (duplicate.rowCount) throw new ConflictException('A current mandate already exists for this representative.');

      const created = await client.query(
        `INSERT INTO sports_representative_mandates
           (player_profile_id, representative_user_id, representative_organization_id,
            mandate_type, permitted_actions, territory_codes, competition_ids,
            starts_at, expires_at, status, representative_response)
         VALUES ($1, $2, $3, $4, $5, $6::char(2)[], $7::uuid[], $8, $9, 'pending', 'pending')
         RETURNING id, player_profile_id, representative_user_id, representative_organization_id,
                   mandate_type, permitted_actions, territory_codes, competition_ids,
                   status, representative_response, starts_at, expires_at, created_at`,
        [id, input.representativeUserId || null, input.representativeOrganizationId || null,
         input.mandateType, input.permittedActions, input.territoryCodes || [],
         input.competitionIds || [], startsAt.toISOString(), expiresAt.toISOString()],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.mandate.created', 'sports_representative_mandate', $2, $3::jsonb)",
        [userId, created.rows[0].id, JSON.stringify({ profile_id: id, representative_type: input.representativeUserId ? 'user' : 'organization', mandate_type: input.mandateType, actions: input.permittedActions, expires_at: expiresAt.toISOString() })],
      );
      if (input.representativeUserId) {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'System', 'Sports Transfer representation request', 'A player has requested to appoint you as a representative. Review the mandate in Sports Transfer.', 'shield-check')",
          [input.representativeUserId],
        );
      } else {
        await client.query(
          `INSERT INTO user_notifications (user_id, category, title, body, icon)
           SELECT user_id, 'System', 'Sports Transfer representation request',
                  'A player has requested to appoint your sporting organization as a representative.', 'shield-check'
           FROM sports_org_memberships
           WHERE sports_organization_id = $1 AND role IN ('owner', 'admin')
             AND status = 'active'
             AND (starts_at IS NULL OR starts_at <= now())
             AND (expires_at IS NULL OR expires_at > now())`,
          [input.representativeOrganizationId],
        );
      }
      await client.query('COMMIT');
      return { mandate: created.rows[0], message: 'Representation request sent. It is not active until accepted and separately verified.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('mandates/:id/accept')
  async acceptMandate(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(sportsRepresentativeMandateResponseBodySchema, body || {});
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        'SELECT * FROM sports_representative_mandates WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!found.rowCount) throw new NotFoundException('Representation request not found.');
      const mandate = found.rows[0];
      if (mandate.status !== 'pending' || mandate.representative_response !== 'pending'
        || new Date(mandate.expires_at).getTime() <= Date.now()
        || (mandate.starts_at && new Date(mandate.starts_at).getTime() > Date.now())) {
        throw new ConflictException('This representation request is not currently available to accept.');
      }
      if (!await this.canRespond(client, mandate, userId)) {
        throw new NotFoundException('Representation request not found.');
      }
      const updated = await client.query(
        `UPDATE sports_representative_mandates
         SET representative_response = 'accepted', responded_by_user_id = $1,
             responded_at = now(), response_note = $2, updated_at = now()
         WHERE id = $3
         RETURNING id, player_profile_id, representative_user_id, representative_organization_id,
                   status, representative_response, responded_by_user_id, responded_at,
                   response_note, expires_at`,
        [userId, input.note || '', id],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.mandate.accepted', 'sports_representative_mandate', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ player_profile_id: mandate.player_profile_id, representative_organization_id: mandate.representative_organization_id })],
      );
      const player = await client.query('SELECT user_id FROM sports_profiles WHERE id = $1', [mandate.player_profile_id]);
      await client.query(
        "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'System', 'Sports Transfer mandate accepted', 'Your representative has accepted the request. TradeMate verification is still required before this mandate can be used.', 'shield-check')",
        [player.rows[0].user_id],
      );
      await client.query('COMMIT');
      return { mandate: updated.rows[0], message: 'Acceptance recorded. The mandate remains inactive until TradeMate completes authority verification.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('mandates/:id/reject')
  async rejectMandate(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(sportsRepresentativeMandateResponseBodySchema, body || {});
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM sports_representative_mandates WHERE id = $1 FOR UPDATE', [id]);
      if (!found.rowCount) throw new NotFoundException('Representation request not found.');
      const mandate = found.rows[0];
      if (mandate.status !== 'pending' || mandate.representative_response !== 'pending'
        || new Date(mandate.expires_at).getTime() <= Date.now()) {
        throw new ConflictException('This representation request is no longer available to reject.');
      }
      if (!await this.canRespond(client, mandate, userId)) {
        throw new NotFoundException('Representation request not found.');
      }
      const updated = await client.query(
        `UPDATE sports_representative_mandates
         SET status = 'rejected', representative_response = 'rejected',
             responded_by_user_id = $1, responded_at = now(), response_note = $2, updated_at = now()
         WHERE id = $3
         RETURNING id, player_profile_id, status, representative_response, responded_at, response_note`,
        [userId, input.note || '', id],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.mandate.rejected', 'sports_representative_mandate', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ player_profile_id: mandate.player_profile_id })],
      );
      const player = await client.query('SELECT user_id FROM sports_profiles WHERE id = $1', [mandate.player_profile_id]);
      await client.query(
        "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'System', 'Sports Transfer mandate declined', 'The representative declined your request.', 'shield-x')",
        [player.rows[0].user_id],
      );
      await client.query('COMMIT');
      return { mandate: updated.rows[0], message: 'Representation request declined.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Post('mandates/:id/revoke')
  async revokeMandate(@Param('id') id: string, @Req() request: Request, @Body() body: unknown) {
    parseUuidParam(id);
    const input = parseBody(sportsRepresentativeMandateResponseBodySchema, body || {});
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE sports_representative_mandates m
         SET status = 'revoked', revoked_at = now(), updated_at = now(), response_note = $2
         FROM sports_profiles p
         WHERE m.id = $1 AND m.player_profile_id = p.id AND p.user_id = $3
           AND m.status IN ('pending', 'active') AND m.revoked_at IS NULL
         RETURNING m.id, m.player_profile_id, m.representative_user_id,
                   m.representative_organization_id, m.status, m.revoked_at, m.response_note`,
        [id, input.note || '', userId],
      );
      if (!updated.rowCount) throw new NotFoundException('Revocable representation mandate not found.');
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.mandate.revoked', 'sports_representative_mandate', $2, $3::jsonb)",
        [userId, id, JSON.stringify({ profile_id: updated.rows[0].player_profile_id })],
      );
      const mandate = updated.rows[0];
      if (mandate.representative_user_id) {
        await client.query(
          "INSERT INTO user_notifications (user_id, category, title, body, icon) VALUES ($1, 'System', 'Sports Transfer mandate revoked', 'The player has revoked your representation mandate. Do not act on their behalf.', 'shield-alert')",
          [mandate.representative_user_id],
        );
      } else {
        await client.query(
          `INSERT INTO user_notifications (user_id, category, title, body, icon)
           SELECT user_id, 'System', 'Sports Transfer mandate revoked',
                  'The player has revoked the representation mandate granted to your organization.', 'shield-alert'
           FROM sports_org_memberships WHERE sports_organization_id = $1
             AND role IN ('owner', 'admin') AND status = 'active'
             AND (starts_at IS NULL OR starts_at <= now())
             AND (expires_at IS NULL OR expires_at > now())`,
          [mandate.representative_organization_id],
        );
      }
      await client.query('COMMIT');
      return { mandate, message: 'Representation mandate revoked. The representative must stop acting on your behalf.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

const MARKET_SYMBOLS = new Set([
  '^GSPC','^DJI','^IXIC','^FTSE','^GDAXI','^FCHI','^N225','^HSI','^STOXX50E','^NSEI',
  'GC=F','SI=F','CL=F','BZ=F','NG=F','HG=F','ZW=F','ZC=F','ZS=F','KC=F',
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','BRK-B','JPM','AVGO',
  '^IRX','^FVX','^TNX','^TYX','TLT','IEF','SHY','GOVT','TIP','VGIT',
]);
type MarketQuote = { symbol: string; price: number; previousClose: number | null; changePercent: number | null; currency: string | null; marketTime: string; exchange: string | null; status: 'live' | 'delayed' };
const marketQuoteCache = new Map<string, { expiresAt: number; value: MarketQuote }>();

@Controller('market')
class PublicMarketQuotesController {
  @Get('quotes')
  async quotes(@Query('symbols') raw: string) {
    parseBody(marketQuotesQuerySchema, { symbols: raw });
    const requested = [...new Set(String(raw || '').split(',').map((s) => s.trim()).filter(Boolean))];
    if (!requested.length || requested.length > 10 || requested.some((symbol) => !MARKET_SYMBOLS.has(symbol))) {
      throw new BadRequestException('Request up to 10 supported market symbols.');
    }
    const now = Date.now();
    const results = await Promise.all(requested.map(async (symbol) => {
      const cached = marketQuoteCache.get(symbol);
      if (cached && cached.expiresAt > now) return cached.value;
      try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=1d&interval=1m';
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 TradeMateMarketData/1.0' },
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) throw new Error('Upstream quote unavailable');
        const payload: unknown = await response.json();
        const chart = isRecord(payload) && isRecord(payload.chart) ? payload.chart : null;
        const resultRows = chart?.result;
        const result = Array.isArray(resultRows) && isRecord(resultRows[0]) ? resultRows[0] : null;
        const meta = result && isRecord(result.meta) ? result.meta : null;
        if (!meta) throw new Error('Upstream returned an invalid quote payload');
        const price = Number(meta?.regularMarketPrice);
        const previous = Number(meta?.chartPreviousClose ?? meta?.previousClose);
        const timestamp = Number(meta?.regularMarketTime) * 1000;
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp) || timestamp <= 0) {
          throw new Error('Upstream returned no current quote');
        }
        const value: MarketQuote = {
          symbol, price, previousClose: Number.isFinite(previous) && previous > 0 ? previous : null,
          changePercent: Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : null,
          currency: typeof meta.currency === 'string' ? meta.currency : null,
          marketTime: new Date(timestamp).toISOString(),
          exchange: typeof meta.fullExchangeName === 'string' ? meta.fullExchangeName : null,
          status: Date.now() - timestamp < 15 * 60 * 1000 ? 'live' : 'delayed',
        };
        marketQuoteCache.set(symbol, { expiresAt: Date.now() + 30000, value });
        return value;
      } catch {
        return { symbol, status: 'unavailable', price: null, previousClose: null, changePercent: null, currency: null, marketTime: null, exchange: null };
      }
    }));
    return { quotes: results, source: 'Yahoo Finance chart data', fetchedAt: new Date().toISOString() };
  }
}


@Controller('sports-transfer')
class SportsTransferOpportunitiesController {
  private async currentUser(request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await resolvePresentedSessionUser(token);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  @Get('opportunities/mine')
  async mine(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT o.id, o.sport, o.movement_type, o.player_profile_id,
              p.display_name AS player_name, o.sporting_organization_id,
              so.display_name AS organization_name, o.created_by_user_id,
              o.title, o.description, o.position_or_role, o.country_code,
              o.competition_name, o.season_label, o.opportunity_direction,
              o.financial_terms, o.visibility, o.status, o.created_at, o.updated_at
       FROM sports_transfer_opportunities o
       LEFT JOIN sports_profiles p ON p.id = o.player_profile_id
       LEFT JOIN sports_organizations so ON so.id = o.sporting_organization_id
       WHERE p.user_id = $1
          OR EXISTS (
            SELECT 1 FROM sports_org_memberships m
            WHERE m.sports_organization_id = o.sporting_organization_id
              AND m.user_id = $1 AND m.status = 'active'
              AND m.role IN ('owner','admin','sporting_director','general_manager','recruiter')
              AND m.permission_scope IN ('workspace','recruitment')
              AND (m.starts_at IS NULL OR m.starts_at <= now())
              AND (m.expires_at IS NULL OR m.expires_at > now())
          )
       ORDER BY o.updated_at DESC LIMIT 100`,
      [userId],
    );
    return { opportunities: result.rows };
  }

  @Post('opportunities')
  async create(@Req() request: Request, @Body() body: unknown) {
    const input = parseBody(sportsTransferOpportunityCreateBodySchema, body);
    const userId = await this.currentUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      if (input.playerProfileId) {
        const profile = await client.query(
          'SELECT id, sport FROM sports_profiles WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [input.playerProfileId, userId],
        );
        if (!profile.rowCount) throw new NotFoundException('Sports Transfer player profile not found.');
        if (profile.rows[0].sport !== input.sport) {
          throw new BadRequestException('The opportunity sport must match the player profile.');
        }
      } else {
        const organization = await client.query(
          'SELECT id FROM sports_organizations WHERE id = $1 FOR UPDATE',
          [input.sportingOrganizationId],
        );
        if (!organization.rowCount) throw new NotFoundException('Sporting organization not found.');
        const membership = await client.query(
          `SELECT role, permission_scope FROM sports_org_memberships
           WHERE sports_organization_id = $1 AND user_id = $2 AND status = 'active'
             AND role IN ('owner','admin','sporting_director','general_manager','recruiter')
             AND permission_scope IN ('workspace','recruitment')
             AND (starts_at IS NULL OR starts_at <= now())
             AND (expires_at IS NULL OR expires_at > now())
           FOR UPDATE`,
          [input.sportingOrganizationId, userId],
        );
        if (!membership.rowCount) throw new ForbiddenException('An active recruitment-scoped organization membership is required.');
      }
      const financialTerms = input.financialTerms || { type: 'undisclosed' };
      const created = await client.query(
        `INSERT INTO sports_transfer_opportunities
          (sport, movement_type, player_profile_id, sporting_organization_id,
           created_by_user_id, title, description, position_or_role, country_code,
           competition_name, season_label, opportunity_direction, financial_terms, visibility, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,'draft')
         RETURNING id, sport, movement_type, player_profile_id, sporting_organization_id,
                   created_by_user_id, title, description, position_or_role, country_code,
                   competition_name, season_label, opportunity_direction, financial_terms,
                   visibility, status, created_at, updated_at`,
        [input.sport, input.movementType, input.playerProfileId || null,
         input.sportingOrganizationId || null, userId, input.title, input.description || '',
         input.positionOrRole || '', input.countryCode || null, input.competitionName || '',
         input.seasonLabel || '', input.opportunityDirection, JSON.stringify(financialTerms),
         input.visibility],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'sports.opportunity.draft_created', 'sports_transfer_opportunity', $2, $3::jsonb)",
        [userId, created.rows[0].id, JSON.stringify({ sport: input.sport, movement_type: input.movementType, owner_type: input.playerProfileId ? 'player' : 'organization', visibility: input.visibility })],
      );
      await client.query('COMMIT');
      return { opportunity: created.rows[0], message: 'Private opportunity draft created. It is not published or discoverable.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

@Module({ controllers: [SportsTransferOpportunitiesController, SportsTransferMandatesController, SportsTransferOrganizationsController, SportsTransferIdentityController, PublicProfilesController, PublicMarketQuotesController, CommunityFeedController, HealthController, AuthController, PreferencesController, NotificationsController, SupportController, OrganizationsController, UserDocumentsController, PublicListingsController, MarketplaceTradesController, P2PMarketController, EnquiriesController, MarketplaceContractsController, ModerationController, PersonaWebhookController, PersonaInquiryController] })
export class AppModule implements OnModuleDestroy {
  async onModuleDestroy() {
    if (databasePool) await databasePool.end();
  }
}
