const request = require("supertest");

const BASE_URL = "http://localhost:3000";

describe("User & Books API", () => {

  let accessToken;

  test("POST /api/register - should register a new user", async () => {
    const response = await request(BASE_URL)
      .post("/api/register")
      .send({
        email: `test${Date.now()}@example.com`,
        password: "password123"
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("id");
    expect(response.body).toHaveProperty("email");
    expect(response.body).toHaveProperty("role");
  });

  test("POST /api/login - should return access and refresh tokens", async () => {
    const response = await request(BASE_URL)
      .post("/api/login")
      .send({
        email: "bookuser@example.com",
        password: "password123"
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");

    accessToken = response.body.accessToken;
  });

  test("GET /api/profile - should return authenticated user", async () => {
    const response = await request(BASE_URL)
      .get("/api/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("id");
    expect(response.body).toHaveProperty("email");
    expect(response.body).not.toHaveProperty("password");
  });

  test("POST /api/books - should create a book", async () => {
    const response = await request(BASE_URL)
      .post("/api/books")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Automated Testing with Jest"
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("id");
    expect(response.body.title).toBe("Automated Testing with Jest");
    expect(response.body).toHaveProperty("userId");
  });

  test("GET /api/books - should return user's books", async () => {
    const response = await request(BASE_URL)
      .get("/api/books")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test("POST /api/logout - should logout successfully", async () => {
    const response = await request(BASE_URL)
      .post("/api/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Logout successful");
  });

});