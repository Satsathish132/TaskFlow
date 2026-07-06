const express=require("express");

const router=express.Router();

const workspaceController=
require("../controllers/workspaceController");

const {
verifyToken
}=require("../middleware/authMiddleware");


router.post(
"/create",
verifyToken,
workspaceController.createWorkspace
);

router.get(
"/my",
verifyToken,
workspaceController.getMyWorkspaces
);

module.exports=router;