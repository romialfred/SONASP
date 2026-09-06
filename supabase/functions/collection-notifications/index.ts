import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { coquille, echapper, paragraphe } from "../envoyer-courriel/gabarit.ts";
import { origineApplication } from "../_shared/application-url.ts";
import {
  collectionNotificationHandler,
  type CollectionMail,
} from "./handler.ts";

Deno.serve(
  collectionNotificationHandler({
    async allowed(authorization, saleId) {
      const actor = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false },
        },
      );
      const { data, error } = await actor.rpc("snp_collection_mail_allowed", {
        p_sale_id: saleId,
      });
      return !error && data === true;
    },
    async prepare() {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: configs, error } = await admin.rpc(
        "snp_configuration_courriel_active",
      );
      if (error) throw new Error("Configuration indisponible");
      const cfg = Array.isArray(configs) ? configs[0] : configs;
      const host = cfg?.hote || Deno.env.get("SONASP_SMTP_HOST");
      const username = cfg?.identifiant || Deno.env.get("SONASP_SMTP_USER");
      const password = cfg?.mot_de_passe || Deno.env.get("SONASP_SMTP_PASS");
      if (!host || !username || !password)
        throw new Error("Messagerie à configurer");
      return {
        async claim(saleId: string): Promise<CollectionMail[]> {
          const { data, error } = await admin.rpc("snp_claim_collection_mail", {
            p_sale_id: saleId,
          });
          if (error) throw error;
          return data || [];
        },
        async send(job: CollectionMail) {
          const smtp = new SMTPClient({
            connection: {
              hostname: host,
              port: Number(
                cfg?.port || Deno.env.get("SONASP_SMTP_PORT") || 465,
              ),
              tls:
                cfg?.securise ?? Deno.env.get("SONASP_SMTP_SECURE") !== "false",
              auth: { username, password },
            },
          });
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              smtp.send({
                from: `${cfg?.expediteur_nom || "Faso SANAMA"} <${cfg?.expediteur_courriel || Deno.env.get("SONASP_SMTP_FROM_EMAIL") || username}>`,
                to: job.to,
                subject: job.title,
                content: job.message,
                html: coquille({
                  titre: echapper(job.title),
                  corps: paragraphe(job.message),
                  origineApplication: origineApplication(
                    Deno.env.get("SONASP_APP_URL"),
                  ),
                }),
              }),
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () => reject(new Error("SMTP timeout")),
                  30_000,
                );
              }),
            ]);
          } finally {
            clearTimeout(timer);
            try {
              await smtp.close();
            } catch {
              /* Delivery outcome remains in the queue. */
            }
          }
        },
        async finish(job: CollectionMail, sent: boolean) {
          const { error } = await admin.rpc("snp_finish_collection_mail", {
            p_id: job.id,
            p_lease: job.lease,
            p_sent: sent,
          });
          if (error) throw error;
        },
      };
    },
  }),
);
