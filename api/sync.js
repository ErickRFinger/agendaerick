// API Serverless para sincronização via Supabase (PostgreSQL REST API)
module.exports = async (req, res) => {
    // Configura Headers de CORS para desenvolvimento local
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Trata preflight OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    let supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    // Se o Supabase não estiver configurado
    if (!supabaseUrl || !supabaseKey) {
        return res.status(200).json({
            success: false,
            error: "SUPABASE_NOT_CONFIGURED",
            message: "Por favor, configure as variáveis de ambiente SUPABASE_URL e SUPABASE_KEY no painel da Vercel (ou no arquivo .env local) para ativar a sincronização."
        });
    }

    // Normaliza URL do Supabase para garantir formato REST focofacil_sync
    supabaseUrl = supabaseUrl.trim();
    if (!supabaseUrl.endsWith('/')) {
        supabaseUrl += '/';
    }
    if (!supabaseUrl.includes('/rest/v1/')) {
        supabaseUrl += 'rest/v1/';
    }
    const endpoint = `${supabaseUrl}focofacil_sync`;

    try {
        if (req.method === 'GET') {
            const { code } = req.query;
            if (!code) {
                return res.status(400).json({ success: false, error: "Código de sincronização ausente." });
            }

            const cleanCode = code.trim().toLowerCase();
            const response = await fetch(`${endpoint}?code=eq.${encodeURIComponent(cleanCode)}&select=state`, {
                method: 'GET',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (response.status === 404) {
                return res.status(200).json({
                    success: false,
                    error: "TABLE_NOT_FOUND",
                    message: "A tabela public.focofacil_sync não foi encontrada no Supabase. Por favor, execute o script SQL de configuração no painel do Supabase."
                });
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro Supabase: ${errText}`);
            }

            const rows = await response.json();
            const payload = (rows && rows.length > 0) ? rows[0].state : null;

            return res.status(200).json({
                success: true,
                data: payload
            });
        } 
        
        else if (req.method === 'POST') {
            const { code, state: clientState } = req.body;

            if (!code || !clientState) {
                return res.status(400).json({ success: false, error: "Dados ausentes (code ou state)." });
            }

            const cleanCode = code.trim().toLowerCase();
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    code: cleanCode,
                    state: clientState,
                    updated_at: new Date().toISOString()
                })
            });

            if (response.status === 404) {
                return res.status(200).json({
                    success: false,
                    error: "TABLE_NOT_FOUND",
                    message: "A tabela public.focofacil_sync não foi encontrada no Supabase. Por favor, execute o script SQL de configuração no painel do Supabase."
                });
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro Supabase: ${errText}`);
            }

            return res.status(200).json({
                success: true,
                message: "Dados sincronizados com sucesso."
            });
        } 
        
        else {
            return res.status(405).json({ success: false, error: "Método não permitido." });
        }
    } catch (e) {
        console.error("Erro na API de sincronização:", e);
        return res.status(500).json({
            success: false,
            error: "INTERNAL_SERVER_ERROR",
            message: e.message
        });
    }
};
