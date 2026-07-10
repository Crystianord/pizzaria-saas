-- Migration 002: flag de disponibilidade diária do entregador
-- Separar "ativo no sistema" (ativo) de "trabalhando hoje" (disponivel)
--
-- Execute no Supabase Dashboard → SQL Editor

ALTER TABLE entregadores
  ADD COLUMN IF NOT EXISTS disponivel boolean NOT NULL DEFAULT false;
