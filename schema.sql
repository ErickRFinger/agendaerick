-- ==========================================================================
-- FOCOFÁCIL - SCRIPT SQL COMPLETO DO BANCO DE DADOS
-- ==========================================================================
-- Instruções: Execute este script no SQL Editor do seu banco de dados (Supabase, PostgreSQL, etc.)

-- --------------------------------------------------------------------------
-- 1. TABELA DE SINCRONIZAÇÃO GERAL (ESTADO COMPLETO EM JSONB)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.focofacil_sync (
    code text PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.focofacil_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública" ON public.focofacil_sync;
DROP POLICY IF EXISTS "Permitir inserção e atualização pública" ON public.focofacil_sync;

CREATE POLICY "Permitir leitura pública" ON public.focofacil_sync
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserção e atualização pública" ON public.focofacil_sync
    FOR ALL USING (true) WITH CHECK (true);


-- --------------------------------------------------------------------------
-- 2. ESTRUTURA RELACIONAL PARA MÓDULO FINANCEIRO (OPCIONAL/EXPANSÍVEL)
-- --------------------------------------------------------------------------

-- Tabela de Bancos e Contas
CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#3b82f6',
    balance NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Investimentos
CREATE TABLE IF NOT EXISTS public.financial_investments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Renda Fixa', 'Reserva', 'Ações', 'FIIs', 'Tesouro', 'Cripto'
    account_id VARCHAR(50) REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    initial_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    last_updated DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Lançamentos (Receitas e Despesas)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    account_id VARCHAR(50) REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    category VARCHAR(50) DEFAULT 'Outros',
    transaction_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('paid', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 3. INSERÇÃO DOS BANCOS PADRÃO E INVESTIMENTO INICIAL
-- --------------------------------------------------------------------------
INSERT INTO public.financial_accounts (id, name, color, balance)
VALUES 
    ('acc_btg', 'BTG Pactual', '#3b82f6', 5000.00),
    ('acc_inter', 'Banco Inter', '#f97316', 3200.00),
    ('acc_sicredi', 'Sicredi', '#10b981', 1800.00),
    ('acc_mp', 'Mercado Pago', '#06b6d4', 1200.00)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, color = EXCLUDED.color;

-- Cadastro do Investimento Inicial (CDI do Inter - R$ 45.000,00)
INSERT INTO public.financial_investments (id, name, category, account_id, initial_amount, current_amount, last_updated)
VALUES 
    ('inv_1', 'CDI do Inter', 'Renda Fixa', 'acc_inter', 45000.00, 45000.00, CURRENT_DATE)
ON CONFLICT (id) DO UPDATE 
SET current_amount = EXCLUDED.current_amount;
