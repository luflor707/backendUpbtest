const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const Producto = require('../entities/producto.entity');

const usarAlmacenamientoLocal = !process.env.DATABASE_URL;
const archivoLocal = path.join(__dirname, '../../.local-data/productos.json');

if (usarAlmacenamientoLocal && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL es obligatoria en producción');
}

if (usarAlmacenamientoLocal) {
    console.info('DATABASE_URL no configurada; usando almacenamiento local en .local-data/productos.json');
}

const leerProductosLocales = () => {
    try {
        return JSON.parse(fs.readFileSync(archivoLocal, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
};

const guardarProductosLocales = (productos) => {
    fs.mkdirSync(path.dirname(archivoLocal), { recursive: true });
    fs.writeFileSync(archivoLocal, JSON.stringify(productos, null, 2));
};

const findAll = async () => {
    if (usarAlmacenamientoLocal) {
        return leerProductosLocales().map(Producto.fromRow);
    }

    const { rows } = await pool.query('SELECT * FROM productos ORDER BY id');
    return rows.map(Producto.fromRow);
};

const findById = async (id) => {
    if (usarAlmacenamientoLocal) {
        const producto = leerProductosLocales().find((row) => row.id === id);
        return Producto.fromRow(producto);
    }

    const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    return Producto.fromRow(rows[0]);
};

const create = async ({ nombre, precio, stock }) => {
    if (usarAlmacenamientoLocal) {
        const productos = leerProductosLocales();
        const id = productos.reduce((max, producto) => Math.max(max, producto.id), 0) + 1;
        const producto = { id, nombre, precio, stock, created_at: new Date().toISOString() };
        productos.push(producto);
        guardarProductosLocales(productos);
        return Producto.fromRow(producto);
    }

    const { rows } = await pool.query(
        `INSERT INTO productos (nombre, precio, stock)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [nombre, precio, stock]
    );
    return Producto.fromRow(rows[0]);
};

const update = async (id, { nombre, precio, stock }) => {
    if (usarAlmacenamientoLocal) {
        const productos = leerProductosLocales();
        const indice = productos.findIndex((producto) => producto.id === id);
        if (indice === -1) return null;
        productos[indice] = { ...productos[indice], nombre, precio, stock };
        guardarProductosLocales(productos);
        return Producto.fromRow(productos[indice]);
    }

    const { rows } = await pool.query(
        `UPDATE productos
         SET nombre = $1, precio = $2, stock = $3
         WHERE id = $4
         RETURNING *`,
        [nombre, precio, stock, id]
    );
    return Producto.fromRow(rows[0]);
};

const remove = async (id) => {
    if (usarAlmacenamientoLocal) {
        const productos = leerProductosLocales();
        const restantes = productos.filter((producto) => producto.id !== id);
        if (restantes.length === productos.length) return false;
        guardarProductosLocales(restantes);
        return true;
    }

    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    return rowCount > 0;
};

module.exports = { findAll, findById, create, update, remove };
