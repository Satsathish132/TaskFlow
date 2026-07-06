const express=require("express");

const router=express.Router();

const {
verifyToken
}=require("../middleware/authMiddleware");

const activityController=
require("../controllers/activityController");

router.get(
"/:workspaceId",
verifyToken,
activityController.getActivity
);

module.exports=router;