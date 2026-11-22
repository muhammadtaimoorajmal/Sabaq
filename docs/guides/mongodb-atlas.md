# Connecting Sabaq to MongoDB Atlas

This guide connects the API to a free MongoDB Atlas cluster and fills it with demo data. It takes about ten minutes.

> [!TIP]
> You do not need Atlas to develop Sabaq. When `MONGODB_URI` is empty, `npm run dev:api` starts a temporary database on your computer with the same demo data. Atlas is needed for a deployed, shared installation.

## 1. Create or choose a cluster

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com/).
2. If you have no cluster yet, choose **Create cluster**, pick the free **M0** tier and a region close to your users, and create it.
3. If you already have a cluster, you can reuse it. Each Atlas project allows one free cluster, and Sabaq keeps all its data in its own database (named `sabaq` by default), separate from anything else in the cluster.

## 2. Create a database user for Sabaq

Give Sabaq its own user that can only reach Sabaq's database, so the application can never read or change other data in the cluster.

1. Open **Database & Network Access** → **Database Users** → **Add New Database User**.
2. Authentication method: **Password**. Username: `sabaq-app`. Choose **Autogenerate Secure Password** and copy the password somewhere safe, such as a password manager.
3. Under **Database User Privileges**, choose **Add Specific Privilege**: role `readWrite`, database `sabaq`. Leave the collection empty.
4. Select **Add User**.

## 3. Allow network access

1. Open **Database & Network Access** → **IP Access List** → **Add IP Address**.
2. For local development, choose **Add Current IP Address**.
3. Hosting providers without fixed outgoing addresses (such as Render's free tier) need `0.0.0.0/0` (access from anywhere). This is acceptable only together with the dedicated, least-privilege user and long generated password from step 2. Add it when you deploy, not before.

## 4. Copy the connection string

1. Open **Clusters** → **Connect** on your cluster → **Drivers**.
2. Copy the connection string. It looks like this:

   ```text
   mongodb+srv://sabaq-app:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

3. Replace `<db_password>` with the password from step 2. If the password contains any of `: / ? # [ ] @ %`, [percent-encode](https://www.mongodb.com/docs/manual/reference/connection-string/#std-label-connections-standard-connection-string-format) those characters.

## 5. Configure the API

1. Copy `apps/api/.env.example` to `apps/api/.env`. The `.env` file is ignored by Git and must never be committed.
2. Set the connection string:

   ```bash
   MONGODB_URI=mongodb+srv://sabaq-app:your-password@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=sabaq
   ```

## 6. Load the demo data

From the repository root:

```bash
npm run db:seed -w @sabaq/api
```

The command creates the indexes and a fictional institution, then lists the demo accounts. For safety it:

- refuses to write into a database that contains collections belonging to another application;
- refuses to replace existing Sabaq data unless you add `-- --reset`, which deletes Sabaq's data first.

Check the result in Atlas under **Data Explorer**: the `sabaq` database should contain collections such as `users`, `classes` and `announcements`.

## 7. Start the API

```bash
npm run dev:api
```

Open <http://localhost:4000/api/health/ready>. The response should report `"database": { "status": "up" }`.

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `bad auth : authentication failed` | Wrong username or password, or the password needs percent-encoding (step 4) |
| `Could not connect to the database … after 5 attempts` | Your IP address is not in the access list (step 3), or a firewall blocks port 27017 |
| `querySrv ENOTFOUND` or `ECONNREFUSED` on `_mongodb._tcp` | Some networks block the DNS lookups that `mongodb+srv://` needs. In **Connect** → **Drivers**, choose an older driver version to get a standard `mongodb://` string with every host listed |
| `user is not allowed to do action [insert]` | The user's privilege is on a different database than `MONGODB_DB_NAME` (step 2) |
| `also holds collections that do not belong to Sabaq` | `MONGODB_DB_NAME` points at another application's database; use a dedicated name such as `sabaq` |
