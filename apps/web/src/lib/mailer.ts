import nodemailer from "nodemailer";

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: requireEnv("GMAIL_SMTP_USER"),
          pass: requireEnv("GMAIL_SMTP_APP_PASSWORD"),
        },
      }),
    );
  }

  return transporterPromise;
}

function getFromAddress() {
  return (
    process.env.EMAIL_FROM_ADDRESS ||
    process.env.GMAIL_SMTP_USER ||
    "no-reply@pecal.site"
  );
}

export async function sendLocalRegisterVerificationEmail(params: {
  email: string;
  code: string;
}) {
  const transporter = await getTransporter();

  await transporter.sendMail({
    from: getFromAddress(),
    to: params.email,
    subject: "[Pecal] 이메일 인증 코드",
    text: `Pecal 회원가입 인증 코드는 ${params.code} 입니다. 3분 안에 입력해 주세요.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">Pecal 이메일 인증</h2>
        <p>아래 인증 코드를 3분 안에 입력해 주세요.</p>
        <div style="margin: 20px 0; font-size: 28px; font-weight: 700; letter-spacing: 6px;">
          ${params.code}
        </div>
        <p>본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
      </div>
    `,
  });
}

export async function sendLocalLoginIdReminderEmail(params: {
  email: string;
  loginId: string;
}) {
  const transporter = await getTransporter();

  await transporter.sendMail({
    from: getFromAddress(),
    to: params.email,
    subject: "[Pecal] 아이디 찾기 안내",
    text: `Pecal 일반 로그인 아이디는 ${params.loginId} 입니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">Pecal 아이디 찾기</h2>
        <p>일반 로그인에 사용할 아이디는 아래와 같습니다.</p>
        <div style="margin: 20px 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">
          ${params.loginId}
        </div>
        <p>본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });
}

export async function sendLocalPasswordResetVerificationEmail(params: {
  email: string;
  code: string;
}) {
  const transporter = await getTransporter();

  await transporter.sendMail({
    from: getFromAddress(),
    to: params.email,
    subject: "[Pecal] 비밀번호 재설정 인증 코드",
    text: `Pecal 비밀번호 재설정 인증 코드는 ${params.code} 입니다. 3분 안에 입력해 주세요.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">Pecal 비밀번호 재설정</h2>
        <p>아래 인증 코드를 3분 안에 입력해 주세요.</p>
        <div style="margin: 20px 0; font-size: 28px; font-weight: 700; letter-spacing: 6px;">
          ${params.code}
        </div>
        <p>본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });
}
