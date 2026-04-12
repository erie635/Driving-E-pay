import { v4 as uuidv4 } from 'uuid';

const newBranch = {
  id: uuidv4(),
  name: 'Nairobi Branch',
  secretLink: uuidv4(), // store this, give to branch admin
  // ...
};
