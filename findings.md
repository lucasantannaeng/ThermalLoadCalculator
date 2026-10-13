# TermalLoadCalculator - Risk Surface Findings

## Risk 1 - Auth/Cadastro de Usuário
PRESENT: 4 files contain auth/register/signup/login terms.

## Risk 2 - Front-ends Web com fontes externas
PRESENT: 1 files link to fonts.googleapis.com or fonts.gstatic.com.

## Risk 3 - Analytics, session replay ou telemetria
ABSENT: 0 files contain PostHog, Hotjar, Clarity, LogRocket.

## Risk 4 - Módulos de disparo de e-mail e landing pages de captação
ABSENT: 0 files contain nodemailer, resend, sendgrid, smtp.

## Risk 5 - Apps SaaS com checkout recorrente / assinaturas
PRESENT: 1 files contain stripe, mercadopago, asaas, subscription, recurring.

## Risk 6 - Plataformas com upload ou compartilhamento de conteúdo por usuários
PRESENT: 3 files contain upload, filepicker, dropzone.
