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

    if (isWebContainer) {
      document.body.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          padding: 20px;
        ">
          <div style="
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 600px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          ">
            <svg style="width: 100px; height: 100px; margin: 0 auto 30px;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h1 style="
              font-size: 2.5rem;
              font-weight: 700;
              margin-bottom: 20px;
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
            ">Access Denied</h1>
            <p style="
              font-size: 1.25rem;
              margin-bottom: 30px;
              line-height: 1.6;
              opacity: 0.95;
            ">
              This application is only accessible via the official domain.
            </p>
            <div style="
              background: rgba(255, 255, 255, 0.2);
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 30px;
            ">
              <p style="font-size: 0.9rem; margin-bottom: 10px; opacity: 0.9;">Please access the application at:</p>
              <a href="https://global-shipping.org" style="
                color: #ffd700;
                font-size: 1.5rem;
                font-weight: 600;
                text-decoration: none;
                display: inline-block;
                padding: 10px 20px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                transition: all 0.3s;
              " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
                https://global-shipping.org
              </a>
            </div>
            <p style="
              font-size: 0.85rem;
              opacity: 0.8;
              margin-top: 20px;
            ">
              Security Notice: Development preview URLs are disabled for production use
            </p>
          </div>
        </div>
      `;

      throw new Error('Access denied: Development preview URL not allowed');
    }

    if (!isAllowedDomain && !isLocalDevelopment) {
      document.body.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          padding: 20px;
        ">
          <div style="
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 60px 40px;
            max-width: 600px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          ">
            <svg style="width: 100px; height: 100px; margin: 0 auto 30px;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h1 style="
              font-size: 2.5rem;
              font-weight: 700;
              margin-bottom: 20px;
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
            ">Access Denied</h1>
            <p style="
              font-size: 1.25rem;
              margin-bottom: 30px;
              line-height: 1.6;
              opacity: 0.95;
            ">
              This application is only accessible via the official domain.
            </p>
            <div style="
              background: rgba(255, 255, 255, 0.2);
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 30px;
            ">
              <p style="font-size: 0.9rem; margin-bottom: 10px; opacity: 0.9;">Please access the application at:</p>
              <a href="https://global-shipping.org" style="
                color: #ffd700;
                font-size: 1.5rem;
                font-weight: 600;
                text-decoration: none;
                display: inline-block;
                padding: 10px 20px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                transition: all 0.3s;
              " onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'">
                https://global-shipping.org
              </a>
            </div>
            <p style="
              font-size: 0.85rem;
              opacity: 0.8;
              margin-top: 20px;
            ">
              Current domain: ${hostname}
            </p>
          </div>
        </div>
      `;

      throw new Error('Access denied: Unauthorized domain');
    }
  }, []);

  return <>{children}</>;
}
