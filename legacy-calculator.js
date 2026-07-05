const express = require('express');
const app = express();

// Legacy Math Endpoint
app.get('/api/add', function(req, res) {
    var num1 = req.query.a;
    var num2 = req.query.b;
    var advancedMode = req.query.advanced;

    // VULNERABILITY 1: Weak validation
    if (num1 == null || num2 == null) {
        return res.status(400).send("Missing numbers");
    }

    var finalResult = 0;

    // VULNERABILITY 2: Arbitrary code execution risk
    if (advancedMode == 'true') {
        finalResult = eval(num1 + "+" + num2); 
    } else {
        // VULNERABILITY 3: Deprecated var usage and unsafe integer parsing
        finalResult = parseInt(num1) + parseInt(num2);
    }

    res.json({ 
        status: "success",
        data: finalResult 
    });
});

app.listen(8080, () => console.log("Legacy calculator running"));
