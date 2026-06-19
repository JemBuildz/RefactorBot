export interface LegacyTemplate {
  name: string;
  language: string;
  description: string;
  frameworkSuggestions: string[];
  code: string;
}

export const LEGACY_TEMPLATES: LegacyTemplate[] = [
  {
    name: "Legacy Math/Discount Utility",
    language: "JavaScript (ES5)",
    description: "Old-style JavaScript math functions, loops, and ES5 module.exports exports.",
    frameworkSuggestions: ["FastAPI + Pydantic", "Express + NestJS + TypeScript", "Rust + Axum"],
    code: `function calculateTotal(items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    var price = items[i].price;
    var qty = items[i].qty;
    total += price * qty;
  }
  return total;
}

function applyDiscount(total, discountPercent) {
  if (discountPercent > 100) return total;
  var finalAmount = total * (1 - discountPercent / 100);
  return finalAmount;
}

module.exports = { 
  calculateTotal: calculateTotal, 
  applyDiscount: applyDiscount 
};`
  },
  {
    name: "Dirty Express Callback Auth API",
    language: "JavaScript (Node v8)",
    description: "Unsafe password checks, raw queries, nested callbacks, and poor error handlers.",
    frameworkSuggestions: ["Express + NestJS + TypeScript", "FastAPI + Pydantic", "Go + Gin + Gorm"],
    code: `const db = require('mysql');
const crypto = require('crypto');

function loginUser(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  
  db.query("SELECT * FROM users WHERE email = '" + email + "'", function(err, results) {
    if (err) {
      res.send({ status: "error", msg: err });
    } else {
      if (results.length > 0) {
        var user = results[0];
        // Weak hash check
        var hash = crypto.createHash('md5').update(password).digest('hex');
        if (user.password_hash === hash) {
          db.query("UPDATE users SET last_login = NOW() WHERE id = " + user.id, function(err2) {
            res.send({ 
              status: "success", 
              token: "TOKEN_" + user.id + "_" + Date.now(),
              user: { name: user.name, role: user.role }
            });
          });
        } else {
          res.send({ status: "invalid", msg: "wrong password" });
        }
      } else {
        res.send({ status: "invalid", msg: "user not found" });
      }
    }
  });
}`
  },
  {
    name: "Legacy C++ Record Parser Buffer",
    language: "C++ (Legacy standard)",
    description: "Manual memory buffers, char pointers, and unchecked file stream parsers.",
    frameworkSuggestions: ["Rust + Axum + Serde", "FastAPI + Pydantic", "Spring Boot + Spring Web"],
    code: `#include <iostream>
#include <fstream>
#include <string.h>

struct Record {
    char name[128];
    int age;
    double balance;
};

Record parseLine(char* buffer) {
    Record r;
    char* token = strtok(buffer, ",");
    if(token) strcpy(r.name, token);
    
    token = strtok(NULL, ",");
    if(token) r.age = atoi(token);
    
    token = strtok(NULL, ",");
    if(token) r.balance = atof(token);
    
    return r;
}

void parseDataFile(const char* filepath) {
    std::ifstream file(filepath);
    char line[1024];
    while (file.getline(line, 1024)) {
        Record r = parseLine(line);
        std::cout << "Parsed user " << r.name << " (Age: " << r.age << ", Bal: " << r.balance << ")" << std::endl;
    }
}`
  },
  {
    name: "Legacy Python CSV Matrix Converter",
    language: "Python 2.7",
    description: "Outdated python 2 loops, raw string formatting, and manual JSON dumps.",
    frameworkSuggestions: ["FastAPI + Pydantic", "Express + NestJS + TypeScript", "Flask + SQLAlchemy"],
    code: `import csv
import json

class MatrixConverter:
    def __init__(self, file_path):
        self.file_path = file_path
        self.raw_records = []

    def load_data(self):
        f = open(self.file_path, 'r')
        reader = csv.reader(f)
        for row in reader:
            self.raw_records.append(row)
        f.close()

    def transform_to_json(self):
        records = []
        for row in self.raw_records:
            if len(row) < 3:
                continue
            item = {
                "id": int(row[0]),
                "product_name": row[1].strip(),
                "price": float(row[2])
            }
            records.append(item)
        return json.dumps({"records": records, "count": len(records)})
`
  }
];
