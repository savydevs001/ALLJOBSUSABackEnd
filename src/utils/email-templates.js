import dotenv from "dotenv";
dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL + "/";

const getNotificationTemplate = ({ title, message, ctaUrl }) => {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>

  <style>
    /* Basic reset for most email clients */
    body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; display:block; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    a { text-decoration:none; color:inherit; }

    /* Container */
    .email-wrapper { width:100%; background-color:#f4f6fb; padding:24px 0; }

    /* Card */
    .email-content { max-width:680px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(20,30,60,0.08); }

    /* Header */
    .header { padding:20px 28px; background:linear-gradient(90deg,#002f6c 0%, #01447a 100%); color:#ffffff; }
    .brand { font-weight:700; font-size:18px; letter-spacing:0.2px; }
    .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; }

    /* Body */
    .body { padding:28px; color:#123; font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial; line-height:1.5; }
    h1 { margin:0 0 12px; font-size:20px; color:#002f6c; }
    p { margin:0 0 14px; font-size:15px; color:#334155; }

    /* CTA */
    .cta { display:inline-block; padding:12px 18px; background:#003366; color:#fff; border-radius:8px; font-weight:600; font-size:15px; }
    .small { font-size:13px; color:#6b7280; }

    /* Footer */
    .footer { padding:20px 28px; font-size:13px; color:#6b7280; background:#fbfcff; }

    /* Responsive */
    @media only screen and (max-width:480px) {
      .body { padding:20px; }
      .header { padding:16px 20px; }
      .email-content { border-radius:10px; }
      h1 { font-size:18px; }
      .cta { display:block; width:100%; text-align:center; }
    }
  </style>
</head>
<body>
  <!-- Preheader: short summary that shows in many inbox previews -->
  <span class="preheader">${message}</span>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="email-wrapper">
    <tr>
      <td align="center">
        <table class="email-content" width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <!-- Header -->
          <tr>
  <td align="left" style="padding:20px 28px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; padding:4px; border-radius:6px;">
      <tr>
        <!-- Logo -->
        <td style="padding-right:8px; vertical-align:middle;">
          <img
            src="https://alljobsusa.com/uploads/1756002458619-260308214.png"
            alt="AllJobsUSA Logo"
            width="40"
            height="40"
            style="display:block; border-radius:50%;"
          />
        </td>

        <!-- Brand text -->
        <td style="vertical-align:middle; font-family:Arial,Helvetica,sans-serif; font-weight:bold; font-size:20px; letter-spacing:0.05em; color:#1a4b78;">
          ALL<span style="color:#d30808;">JOBS</span>USA
        </td>
      </tr>
    </table>
  </td>
</tr>


          <!-- Main body -->
          <tr>
            <td class="body" style="padding:28px;">
              <h1>${title}</h1>

              <!-- message block: keeps any HTML you inject here safe if you sanitize on server -->
              <div style="font-size:15px; color:#374151;">
                ${message}
              </div>

              <!-- Spacer -->
              <div style="height:18px;"></div>

              <!-- Optional CTA: replace ${
                FRONTEND_URL + ctaUrl
              } with actual link, or remove this block if not needed -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${
                      FRONTEND_URL + ctaUrl
                    }" class="cta" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:8px 14px;background:#003366;color:#ffffff;border-radius:8px;font-weight:600;">
                      View 
                    </a>
                  </td>
                </tr>
              </table>

              <div style="height:18px;"></div>

              <p class="small" style="margin-top:6px;">
                If the button doesn't work, copy and paste the following URL into your browser:
                <br />
                <a href="${
                  FRONTEND_URL + ctaUrl
                }" style="color:#003366;font-size:13px;">${
    FRONTEND_URL + ctaUrl
  }</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer" style="padding:20px 28px;">
              <table width="100%" role="presentation">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font-weight:600;color:#111827">Need help?</div>
                    <div style="margin-top:6px;">Reply to this email or visit our <a href="${"mailto:info@alljobsusa.com"}" style="color:#003366;">help center</a>.</div>
                  </td>
                  <td style="vertical-align:top;text-align:right;">
                    <div class="small">© ${new Date().getFullYear()} ALLJOBSUSA</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

const getVerificationTemplate = ({ title, message, verificationCode }) => {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>

  <style>
    body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; display:block; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    a { text-decoration:none; color:inherit; }

    .email-wrapper { width:100%; background-color:#f4f6fb; padding:24px 0; }
    .email-content { max-width:680px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(20,30,60,0.08); }

    .header { padding:20px 28px; background:linear-gradient(90deg,#002f6c 0%, #01447a 100%); color:#ffffff; }
    .brand { font-weight:700; font-size:18px; letter-spacing:0.2px; }
    .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; }

    .body { padding:28px; color:#123; font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial; line-height:1.5; }
    h1 { margin:0 0 12px; font-size:20px; color:#002f6c; }
    p { margin:0 0 14px; font-size:15px; color:#334155; }

    .code-block { display:inline-block; padding:14px 24px; background:#f3f4f6; border-radius:8px; font-size:22px; font-weight:700; letter-spacing:4px; color:#111827; margin:16px 0; }

    .small { font-size:13px; color:#6b7280; }
    .footer { padding:20px 28px; font-size:13px; color:#6b7280; background:#fbfcff; }

    @media only screen and (max-width:480px) {
      .body { padding:20px; }
      .header { padding:16px 20px; }
      .email-content { border-radius:10px; }
      h1 { font-size:18px; }
      .code-block { font-size:20px; padding:12px 20px; letter-spacing:3px; }
    }
  </style>
</head>
<body>
  <span class="preheader">${message}</span>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="email-wrapper">
<tr>
  <td align="left" style="padding:20px 28px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; padding:4px; border-radius:6px;">
      <tr>
        <!-- Logo -->
        <td style="padding-right:8px; vertical-align:middle;">
          <img
            src="https://alljobsusa.com/uploads/1756002458619-260308214.png"
            alt="AllJobsUSA Logo"
            width="40"
            height="40"
            style="display:block; border-radius:50%;"
          />
        </td>

        <!-- Brand text -->
        <td style="vertical-align:middle; font-family:Arial,Helvetica,sans-serif; font-weight:bold; font-size:20px; letter-spacing:0.05em; color:#1a4b78;">
          ALL<span style="color:#d30808;">JOBS</span>USA
        </td>
      </tr>
    </table>
  </td>
</tr>


          <!-- Body -->
          <tr>
            <td class="body">
              <h1>${title}</h1>
              <p>${message}</p>

              <div class="code-block">${verificationCode}</div>

              <p class="small" style="margin-top:6px;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <table width="100%" role="presentation">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font-weight:600;color:#111827">Need help?</div>
                    <div style="margin-top:6px;">Reply to this email or contact us at <a href="mailto:info@alljobsusa.com" style="color:#003366;">info@alljobsusa.com</a>.</div>
                  </td>
                  <td style="vertical-align:top;text-align:right;">
                    <div class="small">© ${new Date().getFullYear()} ALLJOBSUSA</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const getTermsUpdateTemplate = ({ title, message, buttonText, buttonUrl }) => {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>

  <style>
    body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table,td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; display:block; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    a { text-decoration:none; color:inherit; }

    .email-wrapper { width:100%; background-color:#f4f6fb; padding:24px 0; }
    .email-content { max-width:680px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 18px rgba(20,30,60,0.08); }

    .header { padding:20px 28px; background:linear-gradient(90deg,#002f6c 0%, #01447a 100%); color:#ffffff; }
    .brand { font-weight:700; font-size:18px; letter-spacing:0.2px; }
    .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; }

    .body { padding:28px; color:#123; font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial; line-height:1.5; }
    h1 { margin:0 0 12px; font-size:20px; color:#002f6c; }
    p { margin:0 0 14px; font-size:15px; color:#334155; }

    .btn { display:inline-block; padding:12px 24px; background:#1a4b78; border-radius:6px; color:#ffffff; font-weight:600; font-size:15px; margin:20px 0; }
    .btn:hover { background:#163b5f; }

    .small { font-size:13px; color:#6b7280; }
    .footer { padding:20px 28px; font-size:13px; color:#6b7280; background:#fbfcff; }

    @media only screen and (max-width:480px) {
      .body { padding:20px; }
      .header { padding:16px 20px; }
      .email-content { border-radius:10px; }
      h1 { font-size:18px; }
      .btn { font-size:14px; padding:10px 20px; }
    }
  </style>
</head>
<body>
  <span class="preheader">${message}</span>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="email-wrapper">
<tr>
  <td align="left" style="padding:20px 28px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; padding:4px; border-radius:6px;">
      <tr>
        <!-- Logo -->
        <td style="padding-right:8px; vertical-align:middle;">
          <img
            src="https://alljobsusa.com/uploads/1756002458619-260308214.png"
            alt="AllJobsUSA Logo"
            width="40"
            height="40"
            style="display:block; border-radius:50%;"
          />
        </td>

        <!-- Brand text -->
        <td style="vertical-align:middle; font-family:Arial,Helvetica,sans-serif; font-weight:bold; font-size:20px; letter-spacing:0.05em; color:#1a4b78;">
          ALL<span style="color:#d30808;">JOBS</span>USA
        </td>
      </tr>
    </table>
  </td>
</tr>


          <!-- Body -->
          <tr>
            <td class="body">
              <h1>${title}</h1>
              <p>${message}</p>

              <a href="${buttonUrl}" class="btn" target="_blank">${buttonText}</a>

              <p class="small" style="margin-top:6px;">We encourage you to review the updated Terms & Conditions. By continuing to use our services, you agree to the new terms.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer">
              <table width="100%" role="presentation">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font-weight:600;color:#111827">Need help?</div>
                    <div style="margin-top:6px;">Reply to this email or contact us at <a href="mailto:info@alljobsusa.com" style="color:#003366;">info@alljobsusa.com</a>.</div>
                  </td>
                  <td style="vertical-align:top;text-align:right;">
                    <div class="small">© ${new Date().getFullYear()} ALLJOBSUSA</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};


export { getNotificationTemplate, getVerificationTemplate , getTermsUpdateTemplate};
