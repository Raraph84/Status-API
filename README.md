# Status API

This is the API part of my status system available at https://github.com/Raraph84/Status-Website

## Setup

### Prerequisites

- A MySQL server
- Git installed to clone the repo
- NodeJS installed to run the API

### Preparing

Clone the repo, install the libs and build the API by running:

```bash
git clone https://github.com/Raraph84/Status-API
cd Status-API/
npm install
npm run build
```

Create a database on your MySQL server, create a MySQL user with edit access to the database, and import `Status-API/database.sql` into the freshly created database

Edit the `Status-API/config.json` to match your database host, username and database name, and update the checker priority ids that will affect from what checker the data served to the website is coming from

Copy the `Status-API/.env.example` to `Status-API/.env` and fill it with your database password, and a randomly generated token that will be used by the admin panel to authenticate  
/!\The PANEL_KEY value should be set or anyone will be able to edit your config

Then start the API by running:

```bash
npm run start
```
