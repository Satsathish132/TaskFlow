const express  = require("express");
const router   = express.Router();
const userCtrl = require("../controllers/userController");
const { verifyToken, requirePasswordChanged } = require("../middleware/authMiddleware");

// ✅ Protected routes
router.use(verifyToken, requirePasswordChanged);

router.get("/",           userCtrl.getOrgUsers);
router.put("/role",       userCtrl.changeUserRole);

// ✅ DELETE must be last to avoid catching other routes
router.delete("/:userId", userCtrl.deleteUser);

module.exports = router;