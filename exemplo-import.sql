-- Exemplo para testar a aba SQL (MySQL)
CREATE TABLE clientes (
    id INT AUTO_INCREMENT NOT NULL,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    saldo DECIMAL(10,2) DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE pedidos (
    id INT AUTO_INCREMENT NOT NULL,
    cliente_id INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'novo',
    total DECIMAL(12,2) NOT NULL,
    criado_em DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_pedidos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE produtos (
    id INT AUTO_INCREMENT NOT NULL,
    nome VARCHAR(160) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    estoque SMALLINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE TABLE itens_pedido (
    id BIGINT AUTO_INCREMENT NOT NULL,
    pedido_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade SMALLINT NOT NULL DEFAULT 1,
    preco_unitario DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id)
);

ALTER TABLE itens_pedido
    ADD CONSTRAINT fk_itens_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id);

ALTER TABLE itens_pedido
    ADD CONSTRAINT fk_itens_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id);
