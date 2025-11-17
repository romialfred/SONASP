# 📋 WORKFLOW COMPLET: Production → Shipping

## ✅ STATUS OFFICIELS

### Production (daily_production.status)
- `prepared` → Production enregistrée, prête
- `ready_for_customs` → Validée pour douane (TRIGGER POINT)
- `shipped` → Expédiée
- `cancelled` → Annulée

### Shipping (shipping_preparations.status)
- `waiting_for_customs_approval` → EN ATTENTE (Initial - AUTO)
- `approved_by_customs` → APPROUVÉ DOUANE (Manuel)
- `ready_for_expedition` → PRÊT EXPÉDITION (Manuel)

**IMPORTANT** :
- ❌ `pending` N'EXISTE PAS dans shipping_preparation_status
- ✅ Utiliser UNIQUEMENT `waiting_for_customs_approval` comme statut initial

## 🔄 WORKFLOW

1. Production créée → status: `prepared`
2. User valide "Prêt pour la Douane" → status: `ready_for_customs`
3. TRIGGER AUTO → Crée shipping avec status: `waiting_for_customs_approval`
4. User approuve douane → status: `approved_by_customs`
5. User prêt expédition → status: `ready_for_expedition`

