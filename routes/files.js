const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const File = require('../models/file');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// before using the multer module, configure the storage
let storage = multer.diskStorage(
  {
    // mention where the uploaded files are going to be stored
    destination: (req, file, cb) => cb(null, 'uploads/'),

    // mention what will be the file name of the uploaded file
    filename: (req, file, cb) => 
    {
      // create a name for the file 
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName)
    },
  });

// mention the maximum file size. The parameter is received in bytes 
// and the max file size should be 100 MB = 1000000 * 100 bytes. 
// .single means we are uploading a single file at a time and 'myfile' is the name of the form with which 
// the user is sending the file to the server
let upload = multer({ storage, limits: { fileSize: 1000000 * 100 }, }).single('myfile'); //100mb

router.post('/', (req, res) => 
{
  // Validate the request
  // if the user has not sent any file to the server then return message 
  // that the user must send a file
  if(!req.file)
  {
    return res.json({error:"All fields are required"});
  }

  // if the user has sent a file then store the file
  upload(req, res, async (err) => 
  {
    // if there is any error in uploading the file then show the error
    if (err) 
    {
      return res.status(500).send({ error: err.message });
    }
    // Now store the file into database
    const file = new File(
      {
        filename: req.file.filename,
        uuid: uuidv4(),
        path: req.file.path,
        size: req.file.size
      });
    const response = await file.save();
    res.json({ file: `${process.env.APP_BASE_URL}/files/${response.uuid}` });
  });
});

router.post('/send', async (req, res) => {
  const { uuid, emailTo, emailFrom, expiresIn } = req.body;
  if (!uuid || !emailTo || !emailFrom) {
    return res.status(422).send({ error: 'All fields are required except expiry.' });
  }
  // Get data from db 
  try {
    const file = await File.findOne({ uuid: uuid });
    // if (file.sender) 
    // {
    //   return res.status(422).send({ error: 'Email already sent once.' });
    // }
    file.sender = emailFrom;
    file.receiver = emailTo;
    const response = await file.save();
    // send mail
    const sendMail = require('../services/mailService');
    sendMail(
    {
      from: emailFrom,
      to: emailTo,
      subject: 'imuShares file sharing services',
      text: `${emailFrom} shared a file with you.`,
      html: require('../services/emailTemplate')(
      {
        emailFrom,
        downloadLink: `${process.env.APP_BASE_URL}/files/${file.uuid}?source=email`,
        size: parseInt(file.size / 1000) + ' KB',
        expires: '24 hours'
      })
    }).then(() => 
    {
      return res.json({ success: true });
    }).catch(err => 
    {
      return res.status(500).json({ error: err });
    });
  } catch (err) 
  {
    return res.status(500).send({ error: 'Something went wrong.' });
  }

});

module.exports = router;