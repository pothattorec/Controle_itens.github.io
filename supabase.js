const db = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function testarConexao() {

    const status = document.getElementById('status-db');

    if (!status) return;

    try {

        const { error } = await db
            .from('materiais')
            .select('codigo')
            .limit(1);

        if (error) throw error;

        status.textContent = '🟢 Conectado';

    } catch (err) {

        console.error('Erro de conexão:', err);

        status.textContent = '🔴 Erro de conexão';
    }
}