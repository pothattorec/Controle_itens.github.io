// =======================
// MATERIAIS
// =======================

async function carregarMateriais() {

    const { data, error } = await db
        .from('materiais')
        .select('*')
        .order('nome');

    if (error) {
        console.error(error);
        return [];
    }

    return data;
}

async function cadastrarMaterial(material) {

    const { error } = await db
        .from('materiais')
        .insert([material]);

    if (error) {
        console.error(error);
        return false;
    }

    return true;
}

async function atualizarMaterial(codigo, dados) {

    const { error } = await db
        .from('materiais')
        .update(dados)
        .eq('codigo', codigo);

    if (error) {
        console.error(error);
        return false;
    }

    return true;
}

async function excluirMaterial(codigo) {

    const { error } = await db
        .from('materiais')
        .delete()
        .eq('codigo', codigo);

    if (error) {
        console.error(error);
        return false;
    }

    return true;
}

// =======================
// ENTRADA
// =======================

async function registrarEntrada(
    codigo,
    quantidade,
    responsavel
) {

    const { data: material, error } = await db
        .from('materiais')
        .select('*')
        .eq('codigo', codigo)
        .single();

    if (error) {
        console.error(error);
        return false;
    }

    const novoEstoque =
        Number(material.estoque) +
        Number(quantidade);

    await db
        .from('materiais')
        .update({
            estoque: novoEstoque
        })
        .eq('codigo', codigo);

    await db
        .from('historico')
        .insert([
            {
                codigo: codigo,
                nome: material.nome,
                qty: quantidade,
                tipo: 'entrada',
                resp: responsavel,
                unidade: material.unidade
            }
        ]);

    return true;
}

// =======================
// SAÍDA
// =======================

async function registrarSaida(
    codigo,
    quantidade,
    responsavel
) {

    const { data: material, error } = await db
        .from('materiais')
        .select('*')
        .eq('codigo', codigo)
        .single();

    if (error) {
        console.error(error);
        return false;
    }

    if (material.estoque < quantidade) {

        alert('Estoque insuficiente');

        return false;
    }

    const novoEstoque =
        Number(material.estoque) -
        Number(quantidade);

    await db
        .from('materiais')
        .update({
            estoque: novoEstoque
        })
        .eq('codigo', codigo);

    await db
        .from('historico')
        .insert([
            {
                codigo: codigo,
                nome: material.nome,
                qty: quantidade,
                tipo: 'saida',
                resp: responsavel,
                unidade: material.unidade
            }
        ]);

    return true;
}

// =======================
// HISTÓRICO
// =======================

async function carregarHistorico() {

    const { data, error } = await db
        .from('historico')
        .select('*')
        .order('criado_em', {
            ascending: false
        });

    if (error) {
        console.error(error);
        return [];
    }

    return data;
}