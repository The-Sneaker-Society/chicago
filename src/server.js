import { ApolloServer, gql } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
import express from 'express';
import cors from 'cors';
import http from 'http';
import typeDefs from './types/typeDefs';
import resolvers from './resolvers';
import connectDb from './config/db';
import { uploadImage } from './utils/ImageUpload';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3 } from 'aws-sdk';
import { authFirebase } from './firebaseUtils/authFire';
import { GraphQLError } from 'graphql';
// import {
//   getProducts,
//   testStripTransaction,
//   createExpressUser,
//   getAccount,
//   createSession,
//   acceptTOS,
// } from './stripe/utilsStripe';
import { createProduct } from './stripe/products/productUtlis';

async function startApolloServer() {
  const app = express();
  app.use(cors());
  // test
  // const s3 = new S3();

  // const upload = multer({
  //   storage: multerS3({
  //     s3: s3,
  //     bucket: process.env.AWS_BUCKET_NAME,
  //     metadata: function (req, file, cb) {
  //       cb(null, { fieldName: file.fieldname });
  //     },
  //     key: function (req, file, cb) {
  //       cb(null, Date.now().toString());
  //     },
  //   }),
  //   limits: { fileSize: 52428800 },
  // });

  // app.post("/upload", upload.array("files", 3), function (req, res, next) {
  //   res.send({
  //     message: "Uploaded!",
  //     urls: req.files.map(function (file) {
  //       return {
  //         url: file.location,
  //         name: file.key,
  //         type: file.mimetype,
  //         size: file.size,
  //       };
  //     }),
  //   });
  // });

  app.get('/', (req, res) => {
    res.send('hello world');
  });
  app.get('/stripe', async (req, res) => {
    // const test = testStripTransaction();
    // const test = await createExpressUser();
    // const test = await acceptTOS();
    // const test = await getAccount();
    // const test = await createSession();
    const test = await createProduct();
    // const test = await getProducts();

    res.send(test);
  });

  // const upload = multer({ dest: "uploads/" });
  // app.post("/photo", upload.single("file"), uploadImage);

  // const upload = multer({ dest: "uploads/" });
  // app.post("/upload", upload.array("files", 5), uploadImage);

  const httpServer = http.createServer(app);

  connectDb();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError: (error) => {
      if (error.message.startsWith('Database error: ')) {
        return new Error('Internal server error');
      }
      return error;
    },
    // context: async ({ req, res }) => {
    //   try {
    //     // const token = req.headers.authorization || "";
    //     const token =
    //       "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk3OGI1NmM2NmVhYmIwZDlhNmJhOGNhMzMwMTU2NGEyMzhlYWZjODciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQWxhbmlzIFlhdGVzIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FMbTV3dTNrWXhIVHpKSWk2cUJXLUptTDFjN2NDYjNsaE45WWVENmlQOHdKPXM5Ni1jIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3NuZWFrZXItc29jaWV0eSIsImF1ZCI6InNuZWFrZXItc29jaWV0eSIsImF1dGhfdGltZSI6MTY3MDQ1NDI0MCwidXNlcl9pZCI6Ik1DT205RUdIeEVWRVh4MDRpMDRrUWFka29rSjIiLCJzdWIiOiJNQ09tOUVHSHhFVkVYeDA0aTA0a1FhZGtva0oyIiwiaWF0IjoxNjcwNDU0MjQwLCJleHAiOjE2NzA0NTc4NDAsImVtYWlsIjoiYWxhbmlzeWF0ZXM5NkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwODk0NzM3NjkyODc5NDI1MDY0MSJdLCJlbWFpbCI6WyJhbGFuaXN5YXRlczk2QGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.htEF7-IAKGi0Upcn_8fo9KUieJdD_PDBgI2QtF2GgJAVKNDm3z838LP8l4dO3irR39U1srCPQlmbwMnbFk4kfGAvcialncqNXbHB2LHEcZ_RpfibI65VZNc4Oeb6aQdntIQX4gF9qHqAQHU052jsS-JZWz8SayysaFEndA_EWrwQgBNTI1KSnCiYX2zwkV1OLLkSHj57P2CrtwilgI6Uy39Opxq1cVvyvRiWmf2u_9UKLvj5DOKiKyDfHJRcHLNLFZbKFXwGzj5FkP8MMgUGqOJB3_nmozmGumjstPB_y1n1InahWT5ZTfhBK3bTjoCgBy-S4WGXUOEf21DgGw1L6A";
    //     const user = await authFirebase(token);

    //     if (!user) {
    //       throw new GraphQLError("User Not Authenticated", {
    //         extensions: {
    //           code: "UNAUTENICATED",
    //           http: { status: 401 },
    //         },
    //       });
    //     }

    //     return { user };
    //   } catch (e) {
    //     throw e;
    //   }
    // },
  });

  await server.start();
  server.applyMiddleware({ app });
  httpServer.listen({ port: process.env.PORT || 4000 });
  console.log(`🚀 Server ready at ${server.graphqlPath}`);
}

// Start the server
startApolloServer();

emailCron.start();
