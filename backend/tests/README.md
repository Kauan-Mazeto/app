# Testes do backend

Este diretório contém um script de smoke tests separado para validar o comportamento principal do sistema sem depender do frontend.

## Como executar

```bash
cd backend
node tests/smoke-tests.js
```

## O que o script valida

- Rotas públicas e protegidas
- Erros de autenticação
- Regras de validação básicas
- Endpoints de referências, fila, estoque e auditoria
