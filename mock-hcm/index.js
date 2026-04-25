const express = require("express");
const app = express();
app.use(express.json());

// In-memory balance store
const balances = {
  emp1_PK: 20,
  emp2_PK: 10,
  emp3_PK: 10,
};

const getKey = (employeeId, locationId) => `${employeeId}_${locationId}`;

// Validate balance
app.post("/validate", (req, res) => {
  const { employeeId, locationId, daysRequested } = req.body;
  const key = getKey(employeeId, locationId);
  const balance = balances[key] ?? 0;

  if (balance >= daysRequested) {
    return res.json({ approved: true, balance });
  } else {
    return res.json({ approved: false, balance });
  }
});

// Get balance
app.get("/balance/:employeeId/:locationId", (req, res) => {
  const { employeeId, locationId } = req.params;
  const key = getKey(employeeId, locationId);
  const balance = balances[key] ?? 0;
  return res.json({ employeeId, locationId, balance });
});

// Simulate anniversary bonus — adds 5 days
app.post("/bonus/:employeeId/:locationId", (req, res) => {
  const { employeeId, locationId } = req.params;
  const key = getKey(employeeId, locationId);
  balances[key] = (balances[key] ?? 0) + 5;
  return res.json({ message: "Bonus applied", balance: balances[key] });
});

// Batch endpoint — returns all balances
app.get("/batch", (req, res) => {
  const result = Object.entries(balances).map(([key, balance]) => {
    const [employeeId, locationId] = key.split("_");
    return { employeeId, locationId, balance };
  });
  return res.json(result);
});

app.listen(3001, () => console.log("Mock HCM running on port 3001"));
