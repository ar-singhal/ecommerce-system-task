const http = require('http');
const express = require('express');
const mysql = require('mysql');

// const { Sequelize, DataTypes } = require('sequelize');


const app = express();
app.use(express.json());

// const sequelize = new Sequelize('ecomm_task_DB', 'sa', 'admin@123', {
//     host: 'localhost',
//     dialect: 'mysql',
//   });

const connection = mysql.createConnection ({
    host: 'LAPTOP-COEABM62',
    user: 'sa',
    password: 'admin@123',
    database: 'ecomm_taskDB' 
});

const dbConfig = {
  host: 'LAPTOP-COEABM62',
    user: 'sa',
    password: 'admin@123',
    database: 'ecomm_taskDB' 
};

// Create a MySQL connection pool
const pool = mysql.createPool(dbConfig);

// Connect to the MySQL database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database: ' + err.stack);
        return;
  }
    console.log('Connected to the database as ID ' + connection.threadId);
});

app.post('/products', async (req, res) => {
  const { name, description, price, variants } = req.body;

  try {
    // Start a MySQL transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert the product into the 'products' table
      const [productResult] = await connection.query(
        'INSERT INTO products (name, description, price) VALUES (?, ?, ?)',
        [name, description, price]
      );

      const productId = productResult.insertId;

      // Insert variants into the 'variants' table with the corresponding product ID
      await Promise.all(
        variants.map(async (variant) => {
          await connection.query(
            'INSERT INTO variants (name, SKU, additional_cost, stock_count, product_id) VALUES (?, ?, ?, ?, ?)',
            [variant.name, variant.SKU, variant.additionalCost, variant.stockCount, productId]
          );
        })
      );

      // Commit the transaction
      await connection.commit();

      res.status(201).json({ message: 'Product created successfully' });
    } catch (error) {
      // Rollback the transaction on error
      await connection.rollback();
      throw error;
    } finally {
      // Release the connection back to the pool
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to get all products
app.get('/products', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products');
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to update a product
app.put('/products/:productId', async (req, res) => {
  const productId = parseInt(req.params.productId);
  const { name, description, price, variants } = req.body;

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Update the product in the 'products' table
      await connection.query(
        'UPDATE products SET name = ?, description = ?, price = ? WHERE id = ?',
        [name, description, price, productId]
      );

      // Delete existing variants for the product
      await connection.query('DELETE FROM variants WHERE product_id = ?', [productId]);

      // Insert new variants for the product
      await Promise.all(
        variants.map(async (variant) => {
          await connection.query(
            'INSERT INTO variants (name, SKU, additional_cost, stock_count, product_id) VALUES (?, ?, ?, ?, ?)',
            [variant.name, variant.SKU, variant.additionalCost, variant.stockCount, productId]
          );
        })
      );

      // Commit the transaction
      await connection.commit();

      res.json({ message: 'Product updated successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to delete a product
app.delete('/products/:productId', async (req, res) => {
  const productId = parseInt(req.params.productId);

  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete the product and its variants
      await connection.query('DELETE FROM variants WHERE product_id = ?', [productId]);
      await connection.query('DELETE FROM products WHERE id = ?', [productId]);

      // Commit the transaction
      await connection.commit();

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint to search products by name, description, or variant name
app.get('/products/search', async (req, res) => {
  const searchQuery = req.query.q;

  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query parameter (q) is required.' });
  }

  try {
    const connection = await pool.getConnection();

    // Search for products based on the provided query
    const [results] = await connection.query(
      `
      SELECT DISTINCT p.*, v.name AS variant_name
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      WHERE p.name LIKE ? OR p.description LIKE ? OR v.name LIKE ?
    `,
      [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]
    );

    connection.release();

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// default URL to API
// app.use('/', function(req, res) {
//     res.send('node-products-api works :-)');
// });

const server = http.createServer(app);
const port = 3000;
server.listen(port);

console.debug('Server listening on port ' + port);