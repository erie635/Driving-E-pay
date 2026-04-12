export default async function handler(req, res) {
  console.log('Mock API called');
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const { phoneNumbers, message } = req.body;
    console.log('Received:', { phoneNumbers, message });
    
    // Mock response
    return res.status(200).json({
      sent: phoneNumbers.length,
      total: phoneNumbers.length,
      errors: []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}