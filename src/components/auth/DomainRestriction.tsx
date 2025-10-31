import { useEffect } from 'react';

const ALLOWED_DOMAINS = [
  'global-shipping.org',
  'www.global-shipping.org',
  'localhost',
  '127.0.0.1'
];

export function DomainRestriction({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const hostname = window.location.hostname;

    const isAllowedDomain = ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    const isLocalDevelopment = hostname === 'localhost' ||
                               hostname === '127.0.0.1' ||
                               hostname.startsWith('192.168.') ||
                               hostname.startsWith('10.');

    const isWebContainer = hostname.includes('webcontainer') ||
                          hostname.includes('local-credentialless') ||
                          hostname.includes('.local-');

    const accessDeniedHTML = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Accès Refusé - Global Shipping</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%);
          padding: 20px;
        ">
          <div style="
            max-width: 600px;
            width: 100%;
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
          ">
            <!-- Header -->
            <div style="
              background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
              padding: 40px 30px;
              text-align: center;
            ">
              <svg style="width: 80px; height: 80px; margin: 0 auto 20px; display: block;" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h1 style="
                color: white;
                font-size: 2rem;
                font-weight: 700;
                margin: 0 0 10px 0;
                letter-spacing: -0.5px;
              ">Accès Refusé</h1>
              <p style="
                color: rgba(255, 255, 255, 0.9);
                font-size: 1rem;
                margin: 0;
                line-height: 1.5;
              ">Cette application n'est accessible que via le domaine officiel</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <!-- Alert Box -->
              <div style="
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px 20px;
                border-radius: 8px;
                margin-bottom: 30px;
              ">
                <p style="
                  margin: 0;
                  color: #92400e;
                  font-size: 0.9rem;
                  line-height: 1.6;
                ">
                  <strong>Notice de sécurité:</strong> Les URLs de prévisualisation de développement sont désactivées pour l'utilisation en production.
                </p>
              </div>

              <!-- Access Button -->
              <div style="text-align: center; margin-bottom: 35px;">
                <p style="
                  color: #475569;
                  font-size: 0.95rem;
                  margin: 0 0 20px 0;
                  font-weight: 500;
                ">Veuillez accéder à l'application via le domaine officiel:</p>
                <a href="https://global-shipping.org" style="
                  display: inline-block;
                  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
                  color: white;
                  padding: 16px 40px;
                  border-radius: 12px;
                  text-decoration: none;
                  font-weight: 600;
                  font-size: 1.1rem;
                  box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5);
                  transition: all 0.3s ease;
                  letter-spacing: 0.3px;
                " onmouseover="
                  this.style.transform='translateY(-2px)';
                  this.style.boxShadow='0 15px 30px -5px rgba(37, 99, 235, 0.6)';
                " onmouseout="
                  this.style.transform='translateY(0)';
                  this.style.boxShadow='0 10px 25px -5px rgba(37, 99, 235, 0.5)';
                ">
                  Cliquez Ici pour accéder
                </a>
              </div>

              <!-- Divider -->
              <div style="
                height: 1px;
                background: linear-gradient(to right, transparent, #e2e8f0, transparent);
                margin: 35px 0;
              "></div>

              <!-- Contact Info -->
              <div style="
                background: #f8fafc;
                border-radius: 12px;
                padding: 25px;
                border: 1px solid #e2e8f0;
              ">
                <h3 style="
                  color: #1e293b;
                  font-size: 1.1rem;
                  font-weight: 600;
                  margin: 0 0 20px 0;
                  text-align: center;
                ">Besoin d'assistance?</h3>

                <div style="display: flex; flex-direction: column; gap: 15px;">
                  <!-- Email -->
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
                      width: 40px;
                      height: 40px;
                      border-radius: 10px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      flex-shrink: 0;
                    ">
                      <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p style="margin: 0; color: #64748b; font-size: 0.85rem; font-weight: 500;">Email</p>
                      <a href="mailto:infos@business-tech.net" style="
                        color: #2563eb;
                        font-size: 0.95rem;
                        font-weight: 600;
                        text-decoration: none;
                        margin: 0;
                      " onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                        infos@business-tech.net
                      </a>
                    </div>
                  </div>

                  <!-- Phone -->
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
                      width: 40px;
                      height: 40px;
                      border-radius: 10px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      flex-shrink: 0;
                    ">
                      <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div>
                      <p style="margin: 0; color: #64748b; font-size: 0.85rem; font-weight: 500;">Téléphone</p>
                      <a href="tel:+2250767344711" style="
                        color: #2563eb;
                        font-size: 0.95rem;
                        font-weight: 600;
                        text-decoration: none;
                        margin: 0;
                      " onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                        +225 07 67 34 47 11
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div style="
                text-align: center;
                margin-top: 30px;
                padding-top: 25px;
                border-top: 1px solid #e2e8f0;
              ">
                <p style="
                  color: #94a3b8;
                  font-size: 0.85rem;
                  margin: 0;
                  line-height: 1.6;
                ">
                  © 2025 Global Shipping - Tous droits réservés<br>
                  Plateforme sécurisée de gestion des expéditions
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    if (isWebContainer) {
      document.open();
      document.write(accessDeniedHTML);
      document.close();
      throw new Error('Access denied: Development preview URL not allowed');
    }

    if (!isAllowedDomain && !isLocalDevelopment) {
      document.open();
      document.write(accessDeniedHTML);
      document.close();
      throw new Error('Access denied: Unauthorized domain');
    }
  }, []);

  return <>{children}</>;
}
