const axios = require("axios")

axios.defaults.baseURL = `${process.env.COURIER_API_URL}`
axios.defaults.headers.common["key"] = `${process.env.COURIER_API_KEY}`
axios.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded"

module.exports = {
  getProvinces: async (req, res) => {
    try {
      const response = await axios.get("/province")
      res.json(response.data)
    } catch (error) {
      res.send(error)
    }
  },
  getCities: async (req, res) => {
    try {
      const response = await axios.get(`/city?province=${req.body.provinceId}`)
      res.json(response.data)
    } catch (error) {
      res.send(error)
    }
  },
  getCosts: async (req, res) => {
    try {
      const response = await axios.post("/cost", {
        origin: req.body.origin,
        destination: req.body.destination,
        weight: req.body.weight,
        courier: req.body.courier,
      })
      res.json(response.data)
    } catch (error) {
      res.send(error)
    }
  },
}
