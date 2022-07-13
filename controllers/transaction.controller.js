const {
  Transaction,
  Product,
  Picture,
  Category,
  Notification,
  User,
  UserBiodata,
} = require("../models");
const { Op } = require("sequelize");
const { mapProduct } = require("./product.controller");

const mapTransaction = (transaction) => {
  const mappedProductData = mapProduct(transaction.Product);

  return {
    id: transaction.id,
    product: mappedProductData,
    buyer: transaction.User.UserBiodatum,
    price: transaction.price,
    status: transaction.status,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
};

module.exports = {
  mapTransaction,
  getTransactions: async (req, res) => {
    try {
      // Get User Transaction
      const transactions = await Transaction.findAll({
        where: {
          [Op.or]: [
            {
              buyer_id: req.query.as === "seller" ? -1 : req.user.id,
            },
            {
              "$Product.seller_id$":
                req.query.as === "buyer" ? -1 : req.user.id,
            },
          ],
          status: {
            [Op.like]: req.query.status ? req.query.status.toUpperCase() : "%",
          },
        },
        include: [
          {
            model: Product,
            include: [
              Picture,
              Category,
              {
                model: User,
                include: [UserBiodata],
              },
            ],
          },
          {
            model: User,
            include: [UserBiodata],
          },
        ],
      });

      const transactionsData = transactions.map((transaction) =>
        mapTransaction(transaction)
      );

      res.status(200).json({
        transactions: transactionsData,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        type: "SYSTEM_ERROR",
        message: "Something wrong with server",
      });
    }
  },

  getTransaction: async (req, res) => {
    // Validate transaction ID param
    if (!req.params || !req.params.id || !Number.isInteger(+req.params.id)) {
      return res.status(400).json({
        type: "VALIDATION_FAILED",
        message: "Valid Product ID is required",
      });
    }

    try {
      // Get transaction
      const transaction = await Transaction.findOne({
        where: {
          id: req.params.id,
        },
        include: [
          {
            model: Product,
            include: [
              Picture,
              Category,
              {
                model: User,
                include: [UserBiodata],
              },
            ],
          },
          {
            model: User,
            include: [UserBiodata],
          },
        ],
      });

      // Check if product not found
      if (!transaction) {
        return res.status(404).json({
          type: "NOT_FOUND",
          message: "Transaction not found",
        });
      }

      res.status(200).json({
        transaction: mapTransaction(transaction),
      });
    } catch (error) {
      res.status(500).json({
        type: "SYSTEM_ERROR",
        message: "Something wrong with server",
      });
    }
  },

  createTransaction: async (req, res) => {
    if (
      !Number.isInteger(+req.params.productId) ||
      !req.body ||
      !req.body.price ||
      !Number.isInteger(+req.body.price)
    ) {
      return res.status(400).json({
        type: "VALIDATION_FAILED",
        message: "Valid product ID and offered price is required",
      });
    }

    try {
      // Check User Biodata Verification
      const biodata = await UserBiodata.findOne({
        where: { user_id: req.user.id },
      });

      if (
        !biodata ||
        !biodata.name ||
        !biodata.city ||
        !biodata.address ||
        !biodata.phone_number ||
        !biodata.picture
      ) {
        return res.status(400).json({
          type: "VALIDATION_FAILED",
          message: "User biodata must be filled in completely",
        });
      }

      const product = await Product.findOne({
        where: { id: req.params.productId },
      });

      if (!product) {
        return res.status(404).json({
          type: "NOT_FOUND",
          message: "Product not found",
        });
      }

      const newTransaction = await Transaction.create({
        product_id: req.params.productId,
        buyer_id: req.user.id,
        price: req.body.price,
        status: "PENDING",
      });

      const transaction = await Transaction.findOne({
        where: {
          id: newTransaction.id,
        },
        include: [
          {
            model: Product,
            include: [
              Picture,
              Category,
              {
                model: User,
                include: [UserBiodata],
              },
            ],
          },
          {
            model: User,
            include: [UserBiodata],
          },
        ],
      });

      // Create New Product Offer Notification
      await Notification.create({
        type: "NEW_OFFER",
        user_id: product.seller_id,
        transaction_id: transaction.id,
      });

      res.status(200).json({
        transaction: mapTransaction(transaction),
      });
    } catch (error) {
      res.status(500).json({
        type: "SYSTEM_ERROR",
        message: "Something wrong with server",
      });
    }
  },

  updateTransaction: async (req, res) => {
    if (!Number.isInteger(+req.params.id)) {
      return res.status(400).json({
        type: "VALIDATION_FAILED",
        message: "Valid Transaction ID required",
      });
    }

    if (
      req.body.status &&
      req.body.status.toLowerCase() !== "pending" &&
      req.body.status.toLowerCase() !== "accepted" &&
      req.body.status.toLowerCase() !== "rejected" &&
      req.body.status.toLowerCase() !== "completed"
    ) {
      return res.status(400).json({
        type: "VALIDATION_FAILED",
        message: "Valid status is required",
      });
    }

    const { price, status } = req.body;

    try {
      // Check if user is either buyer or seller from transaction
      const userTransaction = await Transaction.findOne({
        where: { id: req.params.id },
        include: [Product],
      });
      if (
        userTransaction &&
        userTransaction.buyer_id !== req.user.id &&
        userTransaction.Product.seller_id !== req.user.id
      ) {
        return res.status(401).json({
          type: "UNAUTHORIZED",
          message: "Unauthorized Access",
        });
      }

      await Transaction.update(
        {
          price: price,
          status: status?.toUpperCase(),
        },
        {
          where: {
            id: req.params.id,
          },
        }
      );
      const transaction = await Transaction.findOne({
        where: {
          id: req.params.id,
        },
        include: [
          {
            model: Product,
            include: [
              Picture,
              Category,
              {
                model: User,
                include: [UserBiodata],
              },
            ],
          },
          {
            model: User,
            include: [UserBiodata],
          },
        ],
      });
      if (!transaction) {
        return res.status(404).json({
          type: "NOT_FOUND",
          message: "Transaction not found",
        });
      }
      res.status(200).json({ updatedTransaction: mapTransaction(transaction) });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        type: "SYSTEM_ERROR",
        message: "Something wrong with server",
      });
    }
  },

  deleteTransaction: async (req, res) => {
    if (!Number.isInteger(+req.params.id)) {
      return res.status(400).json({
        type: "VALIDATION_FAILED",
        message: "Valid Transaction ID is required",
      });
    }

    try {
      // Check if user is either buyer or seller from transaction
      const userTransaction = await Transaction.findOne({
        where: { id: req.params.id },
        include: [Product],
      });
      if (
        userTransaction &&
        userTransaction.buyer_id !== req.user.id &&
        userTransaction.Product.seller_id !== req.user.id
      ) {
        return res.status(401).json({
          type: "UNAUTHORIZED",
          message: "Unauthorized Access",
        });
      }

      const result = await Transaction.destroy({
        where: { id: req.params.id },
      });
      if (result === 0) {
        res
          .status(404)
          .json({ type: "NOT_FOUND", message: "Transaction not found" });
      } else {
        console.log(result);
        res.status(200).json({ message: "Transaction successfully deleted" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({
        type: "SYSTEM_ERROR",
        message: "Something wrong with server",
      });
    }
  },
};
