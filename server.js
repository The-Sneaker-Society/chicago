import express from "express";
import morgan from "morgan";

const app = express();
app.use(morgan('tiny'))

app.get('/', (req, res) => {
    res.send('Hello World');
});
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
});