// API Serverless para sincronização via Vercel KV (Upstash Redis)
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

    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    // Se o banco de dados KV não estiver vinculado na Vercel
    if (!kvUrl || !kvToken) {
        return res.status(200).json({
            success: false,
            error: "KV_DATABASE_NOT_CONFIGURED",
            message: "Por favor, vincule um banco de dados Vercel KV no painel do seu projeto Vercel para ativar a sincronização."
        });
    }

    try {
        if (req.method === 'GET') {
            const { code } = req.query;
            if (!code) {
                return res.status(400).json({ success: false, error: "Código de sincronização ausente." });
            }

            const cleanCode = code.trim().toLowerCase();
            const response = await fetch(kvUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${kvToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(['GET', `agenda_${cleanCode}`])
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro Upstash Redis: ${errText}`);
            }

            const resData = await response.json();
            const payload = resData.result ? JSON.parse(resData.result) : null;

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
            const response = await fetch(kvUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${kvToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(['SET', `agenda_${cleanCode}`, JSON.stringify(clientState)])
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro Upstash Redis: ${errText}`);
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
