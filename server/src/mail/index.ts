/**
 * MailProvider — interface seam reserved for future password reset, alerts,
 * and scheduled reports. Not implemented today; the seam is here so future
 * work doesn't require touching service signatures.
 *
 * To implement: write a class implementing this interface (e.g. `SesMailProvider`,
 * `PostmarkMailProvider`, `SmtpMailProvider`) and wire it via the env-driven factory.
 */
export interface MailProvider {
  send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ id: string }>;
}
