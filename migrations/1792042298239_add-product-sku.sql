-- Up Migration
ALTER TABLE products ADD COLUMN sku VARCHAR(40);
CREATE UNIQUE INDEX uniq_products_sku ON products (sku) WHERE sku IS NOT NULL;

-- Down Migration
DROP INDEX uniq_products_sku;
ALTER TABLE products DROP COLUMN sku;